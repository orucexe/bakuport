"""Read-only adapter to the public endpoints used by the official AYNA map."""
import asyncio
import json
import math
import time
from datetime import datetime, timedelta

import httpx
from fastapi import HTTPException

from ..db import aware, utcnow
from ..models import OfficialRouteCache
from .open_data import DATA_DIR

SOURCE_URL = "https://map.ayna.gov.az/"


def positive_id(value) -> int:
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        raise ValueError("Invalid source identifier")
    if isinstance(value, str) and not value.isdigit():
        raise ValueError("Invalid source identifier")
    if int(value) <= 0:
        raise ValueError("Invalid source identifier")
    return int(value)


def coordinate(lat, lng) -> dict:
    lat, lng = float(lat), float(lng)
    if not (math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError("Invalid official route coordinate")
    return {"lat": lat, "lng": lng}


def normalize_catalog(raw) -> dict:
    if not isinstance(raw, list) or not raw:
        raise ValueError("Missing official route catalog")
    routes, ids = [], set()
    for item in raw:
        source_id, code = positive_id(item["id"]), str(item["number"]).strip()
        if source_id in ids or not code or len(code) > 20:
            raise ValueError("Invalid official route catalog entry")
        ids.add(source_id)
        routes.append({"source_id": source_id, "code": code})
    return {"routes": routes}


def normalize_route(raw, expected_id: int) -> dict:
    if positive_id(raw["id"]) != expected_id:
        raise ValueError("Source returned a different route")
    directions, direction_ids = [], set()
    for item in raw["routes"]:
        direction_id = positive_id(item["directionTypeId"])
        if direction_id in direction_ids:
            raise ValueError("Duplicate official route direction")
        direction_ids.add(direction_id)
        shape = [coordinate(point["lat"], point["lng"]) for point in item["flowCoordinates"]]
        if len(shape) < 2:
            raise ValueError("Missing official route geometry")
        stops = []
        for relation in raw["stops"]:
            if positive_id(relation["directionTypeId"]) != direction_id:
                continue
            stop = relation["stop"]
            stops.append({"source_id": positive_id(stop["id"]), "source_code": str(stop.get("code") or ""),
                          "name": str(stop["name"]).strip(), "sequence": len(stops) + 1,
                          **coordinate(stop["latitude"], stop["longitude"])})
        directions.append({"id": direction_id, "label": {1: "Gediş", 2: "Qayıdış"}.get(direction_id, f"İstiqamət {direction_id}"),
                           "shape": shape, "stops": stops})
    if not directions:
        raise ValueError("No route directions published")
    length, tariff = float(raw["routLength"]), float(raw["tariff"]) / 100
    if not all(math.isfinite(value) and value >= 0 for value in (length, tariff)):
        raise ValueError("Invalid official route metadata")
    published_minutes = raw.get('durationMinuts')
    if published_minutes is not None:
        published_minutes = float(published_minutes)
        if not math.isfinite(published_minutes) or published_minutes <= 0:
            published_minutes = None
    return {"source_id": expected_id, "code": str(raw["number"]), "carrier": str(raw.get("carrier") or ""),
            'published_duration_minutes': published_minutes,
            "first_stop": str(raw["firstPoint"]), "last_stop": str(raw["lastPoint"]),
            "length_km": length, "tariff_azn": tariff, "tariff_label": str(raw.get("tariffStr") or f"{tariff:.2f} AZN"),
            "directions": directions}


def bootstrap_official_cache(session) -> None:
    snapshot = json.loads((DATA_DIR / "ayna_snapshot.json").read_text(encoding="utf-8"))
    stamp = datetime.fromisoformat(snapshot["retrieved_at"])
    for key, payload in snapshot["entries"].items():
        if session.get(OfficialRouteCache, key) is None:
            suffix = "/api/bus/getBusList" if key == "catalog" else f"/api/bus/getBusById?id={key.split(':')[1]}"
            session.add(OfficialRouteCache(key=key, payload=payload, source_url=snapshot["api_url"] + suffix,
                                          fetched_at=stamp))
    verified = json.loads((DATA_DIR / 'verified_journey_routes.json').read_text(encoding='utf-8'))
    verified_at = datetime.fromisoformat(verified['retrieved_at'])
    for payload in verified['routes']:
        key = f"route:{payload['source_id']}"
        row = session.get(OfficialRouteCache, key)
        if row is None:
            session.add(OfficialRouteCache(key=key,payload=payload,
                source_url=f"{snapshot['api_url']}/api/bus/getBusById?id={payload['source_id']}",fetched_at=verified_at))
        elif aware(row.fetched_at) < aware(verified_at):
            row.payload, row.fetched_at = payload, verified_at
    session.commit()


class OfficialRoutes:
    def __init__(self, sessions, settings, transport=None):
        self.sessions = sessions
        self.settings = settings
        self.client = httpx.AsyncClient(base_url=settings.ayna_api_url, timeout=8, transport=transport)
        self.lock = asyncio.Lock()
        self.last_request = 0.0
        self.retry_after: dict[str, float] = {}

    def cached(self, key: str):
        with self.sessions() as session:
            return session.get(OfficialRouteCache, key)

    def response(self, row: OfficialRouteCache, stale: bool, from_cache: bool) -> dict:
        return {**row.payload, "source_url": SOURCE_URL, "api_url": row.source_url,
                "fetched_at": aware(row.fetched_at), "stale": stale, "from_cache": from_cache,
                "live_positions_available": False}

    async def fetch(self, key: str, path: str, normalize) -> dict:
        row = self.cached(key)
        if row and utcnow() - aware(row.fetched_at) < timedelta(hours=self.settings.ayna_cache_hours):
            return self.response(row, False, True)
        async with self.lock:
            row = self.cached(key)
            if row and utcnow() - aware(row.fetched_at) < timedelta(hours=self.settings.ayna_cache_hours):
                return self.response(row, False, True)
            if time.monotonic() < self.retry_after.get(key, 0):
                if row:
                    return self.response(row, True, True)
                raise HTTPException(503, "Official source unavailable; retry after one minute")
            await asyncio.sleep(max(0, 1 - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                response = await self.client.get(path)
                response.raise_for_status()
                payload = normalize(response.json())
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                self.retry_after[key] = time.monotonic() + 60
                if row:
                    return self.response(row, True, True)
                raise HTTPException(503, "Official source unavailable; no saved route data") from None
            with self.sessions() as session:
                row = session.get(OfficialRouteCache, key)
                if row is None:
                    row = OfficialRouteCache(key=key, payload=payload, source_url=str(response.url))
                    session.add(row)
                else:
                    row.payload, row.source_url, row.fetched_at = payload, str(response.url), utcnow()
                session.commit()
            self.retry_after.pop(key, None)
            return self.response(row, False, False)

    async def catalog(self) -> dict:
        return await self.fetch("catalog", "/api/bus/getBusList", normalize_catalog)

    async def route(self, source_id: int) -> dict:
        catalog = await self.catalog()
        if not any(route["source_id"] == source_id for route in catalog["routes"]):
            raise HTTPException(404, "Official route not found")
        return await self.fetch(f"route:{source_id}", f"/api/bus/getBusById?id={source_id}",
                                lambda raw: normalize_route(raw, source_id))
