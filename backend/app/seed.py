import math
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import utcnow
from .models import Bus, DensitySnapshot, Route, RouteStop, Stop


PATHS = [
    ("DEMO-A", "Mərkəz — Bulvar (demo)", "#087f8c", [
        (40.3840, 49.8480), (40.3860, 49.8540), (40.3860, 49.8600),
        (40.3840, 49.8660), (40.3810, 49.8680), (40.3780, 49.8660),
        (40.3760, 49.8600), (40.3760, 49.8540), (40.3780, 49.8480), (40.3810, 49.8450)]),
    ("DEMO-B", "Yasamal — Mərkəz (demo)", "#8361cd", [
        (40.3890, 49.8070), (40.3920, 49.8130), (40.3930, 49.8220),
        (40.3900, 49.8300), (40.3860, 49.8350), (40.3810, 49.8340),
        (40.3770, 49.8290), (40.3760, 49.8210), (40.3790, 49.8130), (40.3830, 49.8070)]),
    ("DEMO-C", "Nərimanov — Şərq (demo)", "#de8c28", [
        (40.4100, 49.8580), (40.4140, 49.8640), (40.4160, 49.8730),
        (40.4140, 49.8820), (40.4090, 49.8870), (40.4040, 49.8850),
        (40.4000, 49.8790), (40.3990, 49.8700), (40.4020, 49.8620), (40.4060, 49.8570)]),
]


def seed(session: Session) -> None:
    if session.scalar(select(Route.id).limit(1)) is not None:
        return
    now = utcnow()
    for route_id, (code, name, color, coords) in enumerate(PATHS, 1):
        session.add(Route(id=route_id, code=code, name=name, color=color))
        session.flush()
        for index, (lat, lng) in enumerate(coords):
            stop_id = route_id * 100 + index + 1
            session.add(Stop(id=stop_id, name=f"{code} · Dayanacaq {index + 1} (demo)", lat=lat, lng=lng))
            session.flush()
            session.add(RouteStop(route_id=route_id, stop_id=stop_id, sequence=index))
        for index in range(3):
            session.add(Bus(id=route_id * 10 + index + 1, route_id=route_id,
                            plate=f"DEMO-{route_id}{index + 1}", capacity=80))
        for minutes in range(15, 14 * 24 * 60 + 1, 15):
            ts = now - timedelta(minutes=minutes)
            hour = (ts.hour + 4) % 24
            peak = math.exp(-((hour - 8) / 2) ** 2) + math.exp(-((hour - 18) / 2) ** 2)
            score = min(95, 24 + route_id * 4 + peak * 42 + math.sin(minutes / 70) * 4)
            session.add(DensitySnapshot(route_id=route_id, score=score, confidence="synthetic",
                                        synthetic=True, ts=ts))
    session.commit()
