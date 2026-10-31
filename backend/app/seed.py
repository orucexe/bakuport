import math
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import utcnow
from .models import Bus, DensitySnapshot, Route, RouteStop, Stop


REAL_BAKU_ROUTES = [
    (
        "1",
        "Koroğlu NMM — Neftçilər — Mərdəkan (BakuBus)",
        "#0284c7",
        [
            ("Koroğlu NMM", 40.4205, 49.9185),
            ("Böyükşor keçidi", 40.4250, 49.9250),
            ("Sabunçu körpüsü", 40.4280, 49.9320),
            ("Zabrat dairəsi", 40.4320, 49.9450),
            ("Ramana keçidi", 40.4350, 49.9600),
            ("Suraxanı dairəsi", 40.4400, 49.9800),
            ("Binə qəsəbəsi", 40.4450, 50.0050),
            ("Mərdəkan dördyol", 40.4500, 50.0350),
            ("Mərdəkan körpüsü", 40.4550, 50.0500),
            ("Mərdəkan Mərkəz", 40.4580, 50.0600),
        ],
    ),
    (
        "62",
        "Qara Qarayev m/s — Sabunçu qəsəbəsi (BakuBus)",
        "#ff385c",
        [
            ("Qara Qarayev m/s", 40.4182, 49.9385),
            ("Tofiq Abbasov küçəsi", 40.4210, 49.9410),
            ("Şərifli küçəsi", 40.4245, 49.9450),
            ("Bona Dea Hospitalı yanı", 40.4270, 49.9480),
            ("Kamil Balakişiyev", 40.4290, 49.9510),
            ("Yavər Əliyev küçəsi", 40.4320, 49.9540),
            ("Sabunçu bazarı", 40.4350, 49.9560),
            ("Sabunçu Vağzalı", 40.4380, 49.9580),
            ("Bakıxanov keçidi", 40.4360, 49.9520),
            ("137 saylı məktəb", 40.4330, 49.9480),
        ],
    ),
    (
        "14",
        "28 May m/s — Gənclik — 20 Yanvar (BakuBus)",
        "#10b981",
        [
            ("28 May m/s", 40.3795, 49.8491),
            ("Səməd Vurğun bağı", 40.3830, 49.8470),
            ("Təbriz küçəsi", 40.3890, 49.8450),
            ("Zoopark", 40.3950, 49.8480),
            ("Gənclik m/s", 40.4005, 49.8518),
            ("Koala Parkı", 40.4040, 49.8450),
            ("Nəsimi bazarı", 40.4020, 49.8350),
            ("Hərbi Hospital", 40.3990, 49.8220),
            ("Tbilisi prospekti", 40.3970, 49.8140),
            ("20 Yanvar m/s", 40.3995, 49.8078),
        ],
    ),
]


def seed(session: Session) -> None:
    existing_routes = session.scalars(select(Route)).all()
    if existing_routes:
        for route in existing_routes:
            if route.code.startswith("DEMO") or "demo" in route.name.lower():
                for route_id, (code, name, color, stops_data) in enumerate(REAL_BAKU_ROUTES, 1):
                    if route.id == route_id:
                        route.code = code
                        route.name = name
                        route.color = color
        session.commit()
        return
    now = utcnow()
    for route_id, (code, name, color, stops_data) in enumerate(REAL_BAKU_ROUTES, 1):
        session.add(Route(id=route_id, code=code, name=name, color=color))
        session.flush()
        for index, (stop_name, lat, lng) in enumerate(stops_data):
            stop_id = route_id * 100 + index + 1
            session.add(Stop(id=stop_id, name=stop_name, lat=lat, lng=lng))
            session.flush()
            session.add(RouteStop(route_id=route_id, stop_id=stop_id, sequence=index))
        for index in range(3):
            plate_num = f"99-JH-{route_id * 100 + index + 1}"
            session.add(
                Bus(
                    id=route_id * 10 + index + 1,
                    route_id=route_id,
                    plate=plate_num,
                    capacity=85,
                )
            )
        for minutes in range(15, 14 * 24 * 60 + 1, 15):
            ts = now - timedelta(minutes=minutes)
            hour = (ts.hour + 4) % 24
            peak = math.exp(-((hour - 8) / 2) ** 2) + math.exp(-((hour - 18) / 2) ** 2)
            score = min(95, 24 + route_id * 4 + peak * 42 + math.sin(minutes / 70) * 4)
            session.add(
                DensitySnapshot(
                    route_id=route_id,
                    score=score,
                    confidence="high",
                    synthetic=True,
                    ts=ts,
                )
            )
    session.commit()
