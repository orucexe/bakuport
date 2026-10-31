import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db import utcnow
from app.models import Alert, BusPosition, CrowdReport, DensitySnapshot, Route, Stop
from app.seed import seed
from app.services.engine import calculate_tick


def test_surge_uses_new_observations_without_removing_history(client):
    now = utcnow()
    sessions, settings = client.app.state.sessions, client.app.state.settings
    with sessions() as session:
        route = session.get(Route, 1)
        stop = session.get(Stop, 101)
        route.scenario_started_at = now - timedelta(seconds=5)
        for age, speed, level in [(60, 25, 1), (2, 1, 5)]:
            session.add(BusPosition(bus_id=11, lat=stop.lat, lng=stop.lng, speed_kmh=speed, ts=now - timedelta(seconds=age)))
            session.add(CrowdReport(route_id=1, bus_id=11, level=level, ts=now - timedelta(seconds=age)))
        session.commit()
    events = calculate_tick(sessions, settings, now)
    route_density = next(data for name, data in events if name == "density_update" and data["route_id"] == 1)
    assert route_density["score"] >= 70 and route_density["confidence"] == "high"
    with sessions() as session:
        assert session.scalar(select(func.count(CrowdReport.id))) == 2


def test_ingested_report_changes_measured_density(client):
    now = utcnow()
    stop = client.get('/routes/1/stops').json()[0]
    client.post('/gps', json={"bus_id": 11, "lat": stop['lat'], "lng": stop['lng'], "speed_kmh": 18})
    client.post('/crowd-reports', json={"route_id": 1, "bus_id": 11, "level": 1})
    initial = calculate_tick(client.app.state.sessions, client.app.state.settings, utcnow())
    client.post('/crowd-reports', json={"route_id": 1, "bus_id": 11, "level": 5})
    updated = calculate_tick(client.app.state.sessions, client.app.state.settings, utcnow())
    score = lambda events: next(d["score"] for t, d in events if t == "density_update" and d["route_id"] == 1)
    assert score(updated) > score(initial)


def test_database_rejects_duplicate_open_alert_and_seed_is_idempotent(client):
    with client.app.state.sessions() as session:
        before = session.scalar(select(func.count(DensitySnapshot.id)))
        seed(session)
        assert session.scalar(select(func.count(DensitySnapshot.id))) == before
        session.add(Alert(route_id=1, status="open", started_at=utcnow(), message="test"))
        session.commit()
        session.add(Alert(route_id=1, status="open", started_at=utcnow(), message="duplicate"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_slow_llm_does_not_block_alert_or_gps(client, monkeypatch):
    async def slow_recommendation(*args):
        await asyncio.sleep(3600)

    monkeypatch.setattr("app.main.recommendation", slow_recommendation)
    client.app.state.settings.llm_api_key = "test-placeholder"
    now = utcnow()
    with client.app.state.sessions() as session:
        route = session.get(Route, 1)
        route.high_since = now - timedelta(seconds=61)
        route.evaluated_at = now - timedelta(seconds=1)
        session.add(CrowdReport(route_id=1, level=5, ts=now))
        session.commit()
    with client.websocket_connect('/ws/live') as ws:
        client.portal.call(client.app.state.run_tick)
        event = ws.receive_json()
        assert event['type'] == 'alert_created'
        assert event['data']['ai_recommendation'] and event['data']['recommendation_source'] == 'template'
        assert client.post('/gps', json={"bus_id": 11, "lat": 40.38, "lng": 49.85, "speed_kmh": 18}).status_code == 201
