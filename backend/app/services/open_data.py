"""Validated, repeatable import of the two bundled OpenData snapshots."""
import csv
import hashlib
import json
import math
from datetime import date
from pathlib import Path

from sqlalchemy import delete, select

from ..db import utcnow
from ..models import DailyRidership, DataImport, Route, RouteStop, Stop
from .eta import haversine

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def manifest() -> dict:
    return json.loads((DATA_DIR / "manifest.json").read_text(encoding="utf-8"))


def read_stops(path: Path) -> list[dict]:
    result, identifiers = [], set()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        if header != ["ID", "AD", "ID", "LONGITUDE", "LATITUDE", "Tip"]:
            raise ValueError("Unexpected stop CSV columns")
        for row in reader:
            if len(row) != 6:
                raise ValueError("Invalid stop CSV row")
            source_id, name = row[2].strip(), " ".join(row[1].split())
            lng, lat = float(row[3]), float(row[4])
            if abs(lng) > 180:
                lng /= 1_000_000
            if abs(lat) > 90:
                lat /= 1_000_000
            if not (math.isfinite(lat) and math.isfinite(lng) and 39 <= lat <= 42 and 48 <= lng <= 52):
                raise ValueError("Invalid Baku-area stop coordinates")
            if not source_id.isdigit() or not name or source_id in identifiers:
                raise ValueError("Missing or duplicate stop identifier")
            identifiers.add(source_id)
            result.append({"id": int(source_id), "source_id": source_id, "name": name,
                           "lng": lng, "lat": lat, "stop_type": row[5].strip() or None})
    return result


def read_ridership(path: Path) -> list[dict]:
    result, identifiers = [], set()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        if len(header) != 3 or header[1] != "Marşrutun adı":
            raise ValueError("Unexpected ridership CSV columns")
        for row in reader:
            if len(row) != 3:
                raise ValueError("Invalid ridership CSV row")
            stamp, code, rides = date.fromisoformat(row[0].split()[0]), row[1].strip(), int(row[2])
            if not code or len(code) > 20 or rides < 0 or (code, stamp) in identifiers:
                raise ValueError("Invalid or duplicate route/day observation")
            identifiers.add((code, stamp))
            result.append({"route_code": code, "date": stamp, "rides": rides})
    return result


def attach_demo_paths(session, records: list[dict]) -> None:
    """Use nearby real stops on demo loops; this does NOT infer official bus routes."""
    for route in session.scalars(select(Route).where(Route.code.like("DEMO-%"))):
        old = list(session.scalars(select(Stop).join(RouteStop).where(RouteStop.route_id == route.id)
                                  .order_by(RouteStop.sequence)))
        selected, used = [], set()
        for stop in old:
            closest = min((record for record in records if record["id"] not in used),
                          key=lambda record: haversine((stop.lat, stop.lng), (record["lat"], record["lng"])))
            selected.append(closest["id"])
            used.add(closest["id"])
        session.execute(delete(RouteStop).where(RouteStop.route_id == route.id))
        for sequence, stop_id in enumerate(selected):
            session.add(RouteStop(route_id=route.id, stop_id=stop_id, sequence=sequence))
        route.high_since = route.low_since = route.evaluated_at = None


def import_open_data(session, folder: Path = DATA_DIR) -> None:
    metadata = manifest()
    changed = {}
    for key, source in metadata.items():
        path = folder / source["filename"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        previous = session.get(DataImport, key)
        if previous is None or previous.sha256 != digest:
            records = read_stops(path) if key == "stops" else read_ridership(path)
            changed[key] = (digest, records)
    # Parse every changed file before writing, so invalid input cannot partially import.
    for key, (digest, records) in changed.items():
        if key == "stops":
            existing = {stop.id: stop for stop in session.scalars(select(Stop))}
            for record in records:
                stop = existing.get(record["id"])
                if stop is None:
                    session.add(Stop(**record))
                else:
                    for field, value in record.items():
                        setattr(stop, field, value)
            session.flush()
            attach_demo_paths(session, records)
        else:
            existing = {(row.route_code, row.date): row for row in session.scalars(select(DailyRidership))}
            for record in records:
                row = existing.get((record["route_code"], record["date"]))
                if row is None:
                    session.add(DailyRidership(**record))
                else:
                    row.rides = record["rides"]
        previous = session.get(DataImport, key)
        if previous is None:
            session.add(DataImport(key=key, sha256=digest, row_count=len(records)))
        else:
            previous.sha256, previous.row_count, previous.imported_at = digest, len(records), utcnow()
    session.commit()
