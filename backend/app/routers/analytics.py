import time
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import select

from ..db import aware, utcnow
from ..models import Alert, Bus, BusPosition, CrowdReport, DensitySnapshot, Route, RouteStop, Stop
from ..schemas import CrowdInput
from ..services.density import density_label
from ..services.engine import alert_payload, ordered_stops, snapshot_payload
from ..services.eta import eta_minutes

router = APIRouter()


def require_route(session, route_id: int) -> Route:
    route = session.get(Route, route_id)
    if route is None:
        raise HTTPException(404, "Route not found")
    return route


@router.post("/crowd-reports", tags=["Ingestion"], status_code=201,
             summary="Report crowd level 1–5; optional bus must belong to route")
async def crowd_report(payload: CrowdInput, request: Request):
    with request.app.state.sessions() as session:
        require_route(session, payload.route_id)
        if payload.bus_id is not None:
            bus = session.get(Bus, payload.bus_id)
            if bus is None:
                raise HTTPException(404, "Bus not found")
            if bus.route_id != payload.route_id:
                raise HTTPException(422, "Bus does not belong to this route")
        report = CrowdReport(**payload.model_dump())
        session.add(report)
        session.commit()
        result = {"id": report.id, **payload.model_dump(), "ts": report.ts}
    await request.app.state.hub.publish("crowd_report", result)
    return result


@router.get("/stops/{stop_id}/arrivals", tags=["Stops"], summary="Upcoming buses, ETA minutes and crowd level",
            description="Projects fresh bus fixes onto ordered route segments; excludes passed stops and fixes older than 30 seconds.")
def arrivals(stop_id: int, request: Request):
    now = utcnow()
    settings = request.app.state.settings
    with request.app.state.sessions() as session:
        if session.get(Stop, stop_id) is None:
            raise HTTPException(404, "Stop not found")
        result = []
        for route_id in session.scalars(select(RouteStop.route_id).where(RouteStop.stop_id == stop_id)):
            stops = ordered_stops(session, route_id)
            target = next(index for index, stop in enumerate(stops) if stop.id == stop_id)
            snapshot = session.scalar(select(DensitySnapshot).where(DensitySnapshot.route_id == route_id,
                DensitySnapshot.synthetic.is_(False)).order_by(DensitySnapshot.ts.desc(), DensitySnapshot.id.desc()).limit(1))
            for bus in session.scalars(select(Bus).where(Bus.route_id == route_id)):
                positions = list(session.scalars(select(BusPosition).where(
                    BusPosition.bus_id == bus.id, BusPosition.ts >= now - timedelta(minutes=5))
                    .order_by(BusPosition.ts.desc(), BusPosition.id.desc())))
                if not positions or (now - aware(positions[0].ts)).total_seconds() > 30:
                    continue
                latest = positions[0]
                eta = eta_minutes((latest.lat, latest.lng), [(s.lat, s.lng) for s in stops], target,
                                  [p.speed_kmh for p in positions])
                if eta is None:
                    continue
                report = session.scalar(select(CrowdReport).where(CrowdReport.bus_id == bus.id,
                    CrowdReport.ts >= now - timedelta(minutes=5)).order_by(CrowdReport.ts.desc(), CrowdReport.id.desc()).limit(1))
                score = (report.level - 1) * 25 if report else snapshot.score if snapshot else None
                confidence = "reported" if report else snapshot.confidence if snapshot else "unavailable"
                result.append({"bus_id": bus.id, "route_id": route_id, "plate": bus.plate,
                               "eta_minutes": eta, "crowd_score": score,
                               "crowd_level": density_label(score, settings) if score is not None and confidence != "unavailable" else "unknown",
                               "confidence": confidence, "ts": latest.ts})
    return sorted(result, key=lambda item: item["eta_minutes"])


@router.get("/operator/density", tags=["Operator"], summary="Latest measured density; synthetic seed history is excluded")
def current_density(request: Request):
    result = []
    with request.app.state.sessions() as session:
        for route in session.scalars(select(Route).order_by(Route.id)):
            snapshot = session.scalar(select(DensitySnapshot).where(DensitySnapshot.route_id == route.id,
                DensitySnapshot.synthetic.is_(False)).order_by(DensitySnapshot.ts.desc(), DensitySnapshot.id.desc()).limit(1))
            if snapshot:
                result.append(snapshot_payload(snapshot, request.app.state.settings))
    return result


@router.get("/operator/density/{route_id}/history", tags=["Operator"], summary="Density history with explicitly marked synthetic samples")
def history(route_id: int, request: Request, minutes: int = Query(60, ge=1, le=20160)):
    with request.app.state.sessions() as session:
        require_route(session, route_id)
        snapshots = session.scalars(select(DensitySnapshot).where(DensitySnapshot.route_id == route_id,
            DensitySnapshot.ts >= utcnow() - timedelta(minutes=minutes)).order_by(DensitySnapshot.ts, DensitySnapshot.id))
        return [snapshot_payload(snapshot, request.app.state.settings) for snapshot in snapshots]


@router.get("/operator/alerts", tags=["Operator"], summary="Stored high-density alerts and recommendations")
def alerts(request: Request, status: Literal["open", "resolved", "all"] = "open"):
    with request.app.state.sessions() as session:
        query = select(Alert).order_by(Alert.started_at.desc())
        if status != "all":
            query = query.where(Alert.status == status)
        return [alert_payload(alert) for alert in session.scalars(query)]


@router.post("/demo/surge", tags=["Demo"], summary="Demo-only simulator crowd/slowdown control; level 0 disables",
             description="Example: POST /demo/surge?route_id=1&level=5. Only enabled with DEMO_MODE=true. Simulator reads this state on its next tick.")
async def surge(request: Request, route_id: int = Query(..., gt=0), level: int = Query(5, ge=0, le=5)):
    if not request.app.state.settings.demo_mode:
        raise HTTPException(403, "Enable DEMO_MODE to use surge controls")
    with request.app.state.sessions() as session:
        route = require_route(session, route_id)
        route.surge_level = level
        session.commit()
    # Give the simulator one tick to send fresh slow fixes and crowd reports.
    request.app.state.next_tick = min(request.app.state.next_tick, time.monotonic() + 5)
    result = {"route_id": route_id, "level": level, "active": level > 0}
    await request.app.state.hub.publish("surge_changed", result)
    return result
