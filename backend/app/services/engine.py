"""Minute-based analytics, persisted state, and plain serializable event payloads."""
from datetime import datetime, timedelta

from sqlalchemy import select

from ..config import Settings
from ..db import aware
from ..models import Alert, Bus, BusPosition, CrowdReport, DensitySnapshot, Route, RouteStop, Stop
from .alerts import evaluate_alert
from .density import density_label, density_score
from .eta import haversine


def alert_payload(alert: Alert) -> dict:
    return {key: getattr(alert, key) for key in (
        "id", "route_id", "type", "status", "started_at", "resolved_at", "message",
        "ai_recommendation", "recommendation_source")}


def snapshot_payload(snapshot: DensitySnapshot, settings: Settings) -> dict:
    return {"route_id": snapshot.route_id, "score": snapshot.score, "confidence": snapshot.confidence,
            "synthetic": snapshot.synthetic, "ts": snapshot.ts,
            "level": density_label(snapshot.score, settings) if snapshot.confidence != "unavailable" else "unknown"}


def ordered_stops(session, route_id: int) -> list[Stop]:
    return list(session.scalars(select(Stop).join(RouteStop).where(RouteStop.route_id == route_id)
                               .order_by(RouteStop.sequence)))


def calculate_tick(sessions, settings: Settings, now: datetime) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    with sessions() as session:
        for route in session.scalars(select(Route).order_by(Route.id)):
            cutoff = now - timedelta(minutes=5)
            if settings.demo_mode and route.scenario_started_at:
                cutoff = max(cutoff, aware(route.scenario_started_at))
            reports = [(report.level, report.ts) for report in session.scalars(
                select(CrowdReport).where(CrowdReport.route_id == route.id, CrowdReport.ts >= cutoff))]
            speeds, dwells = [], []
            stops = ordered_stops(session, route.id)
            for bus in session.scalars(select(Bus).where(Bus.route_id == route.id)):
                positions = list(session.scalars(select(BusPosition).where(
                    BusPosition.bus_id == bus.id, BusPosition.ts >= cutoff)
                    .order_by(BusPosition.ts.desc(), BusPosition.id.desc())))
                if not positions or (now - aware(positions[0].ts)).total_seconds() > 30:
                    continue
                speeds.append(sum(p.speed_kmh for p in positions) / len(positions))
                latest = positions[0]
                near_stop = any(haversine((latest.lat, latest.lng), (stop.lat, stop.lng)) < 0.06 for stop in stops)
                stationary = []
                if near_stop:
                    for position in positions:
                        if position.speed_kmh > 2 or haversine((latest.lat, latest.lng), (position.lat, position.lng)) > 0.06:
                            break
                        stationary.append(position)
                dwells.append((now - aware(stationary[-1].ts)).total_seconds() if stationary else 0)
            score, confidence = density_score(reports, speeds, dwells, now, settings)
            snapshot = DensitySnapshot(route_id=route.id, score=score, confidence=confidence, ts=now, synthetic=False)
            session.add(snapshot)
            change = evaluate_alert(session, route, score, now, settings, confidence != "unavailable")
            if change:
                event_type, alert = change
                session.flush()
                events.append((event_type, alert_payload(alert)))
            events.append(("density_update", snapshot_payload(snapshot, settings)))
        session.commit()
    return events
