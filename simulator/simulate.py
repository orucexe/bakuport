"""Drive fictional buses along closed route polylines through the public API."""
import argparse
import logging
import math
import os
import random
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

log = logging.getLogger("simulator")


def distance(a: dict, b: dict) -> float:
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    dlat = lat2 - lat1
    dlng = math.radians(b["lng"] - a["lng"])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371 * 2 * math.asin(min(1, math.sqrt(h)))


def point_at(stops: list[dict], progress: float) -> tuple[float, float]:
    for a, b in zip(stops, stops[1:] + stops[:1]):
        length = distance(a, b)
        if progress <= length:
            fraction = progress / max(length, 1e-9)
            return a["lat"] + (b["lat"] - a["lat"]) * fraction, a["lng"] + (b["lng"] - a["lng"]) * fraction
        progress -= length
    return stops[0]["lat"], stops[0]["lng"]


def run(api_url: str, surge_route: int | None = None, steps: int | None = None) -> None:
    progress: dict[int, float] = {}
    previous = time.monotonic()
    tick = 0
    with httpx.Client(base_url=api_url, timeout=8) as client:
        while steps is None or tick < steps:
            try:
                routes_response = client.get("/routes")
                routes_response.raise_for_status()
                routes = routes_response.json()
                elapsed = min(10, max(1, time.monotonic() - previous))
                previous = time.monotonic()
                for route in routes:
                    if surge_route == route["id"] and tick == 0:
                        client.post("/demo/surge", params={"route_id": route["id"], "level": 5}).raise_for_status()
                        route["surge_level"] = 5
                    stops = client.get(f'/routes/{route["id"]}/stops').json()
                    buses = client.get(f'/routes/{route["id"]}/buses').json()
                    total = sum(distance(a, b) for a, b in zip(stops, stops[1:] + stops[:1]))
                    for index, bus in enumerate(buses):
                        busy = route.get("surge_level", 0) > 0
                        speed = random.uniform(0.5, 2) if busy else random.uniform(15, 28)
                        if not busy and tick % 20 in (0, 1):
                            speed = 0
                        progress[bus["id"]] = (progress.get(bus["id"], index * total / len(buses)) + speed * elapsed / 3600) % total
                        lat, lng = point_at(stops, progress[bus["id"]])
                        client.post("/gps", json={"bus_id": bus["id"], "lat": lat, "lng": lng,
                                                   "speed_kmh": speed}).raise_for_status()
                        if tick % 5 == 0:
                            hour = datetime.now(ZoneInfo("Asia/Baku")).hour
                            level = route["surge_level"] if busy else random.choices(
                                [1, 2, 3, 4, 5], [1, 2, 4, 5, 3] if hour in (8, 9, 17, 18, 19) else [4, 5, 3, 2, 1])[0]
                            response = client.post("/crowd-reports", json={"bus_id": bus["id"], "route_id": route["id"], "level": level})
                            if response.status_code != 404:
                                response.raise_for_status()
                tick += 1
                log.info("Sent GPS tick %s for %s routes", tick, len(routes))
            except (httpx.HTTPError, ValueError, KeyError):
                log.exception("Backend unavailable; retrying")
            if steps is None or tick < steps:
                time.sleep(3)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8000"))
    parser.add_argument("--surge-route", type=int)
    parser.add_argument("--steps", type=int, help="Exit after this many successful ticks")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    run(args.api_url, args.surge_route, args.steps)
