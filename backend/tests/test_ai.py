import asyncio
from datetime import timedelta

import httpx
import pytest

from app.db import utcnow
from app.models import DensitySnapshot, Route
from app.services.ai import forecast, recommendation


def test_recommendation_without_key(settings):
    route = Route(code="DEMO-A", name="Demo", color="#087f8c")
    message, source = asyncio.run(recommendation(route, settings))
    assert source == "template" and "DEMO-A" in message and "10" in message


@pytest.mark.parametrize("kind", ["error", "timeout", "malformed", "empty", "success"])
def test_llm_success_and_failure_fallback(settings, kind):
    route = Route(code="DEMO-A", name="Demo", color="#087f8c")
    settings.llm_api_key = "test-placeholder"

    def handler(request):
        assert request.headers["x-api-key"] == "test-placeholder"
        if kind == "timeout":
            raise httpx.ReadTimeout("test timeout")
        if kind == "error":
            return httpx.Response(503, json={"error": "unavailable"})
        if kind == "malformed":
            return httpx.Response(200, json={"unexpected": True})
        return httpx.Response(200, json={"content": [{"type": "text", "text": "Add two buses." if kind == "success" else ""}]})

    message, source = asyncio.run(recommendation(route, settings, httpx.MockTransport(handler)))
    assert source == ("llm" if kind == "success" else "template")
    assert message


def test_seeded_forecast_and_invalid_route(client):
    response = client.get("/operator/forecast/1")
    assert response.status_code == 200
    data = response.json()
    assert data["synthetic_history"] and not data["insufficient_data"]
    assert len(data["points"]) == 4
    assert all(0 <= point["score"] <= 100 for point in data["points"])
    assert data["points"][0]["ts"] < data["points"][-1]["ts"]
    assert client.get("/operator/forecast/999").status_code == 404


def test_forecast_empty_and_baku_day_hour(client):
    now = utcnow().replace(hour=4, minute=0, second=0)  # 08:00 Baku.
    with client.app.state.sessions() as session:
        route = Route(code="DEMO-TEST", name="Test", color="#087f8c")
        session.add(route)
        session.flush()
        assert forecast(session, route.id, now)["insufficient_data"]
        session.add_all([
            DensitySnapshot(route_id=route.id, score=90, confidence="high", ts=now - timedelta(days=7)),
            DensitySnapshot(route_id=route.id, score=10, confidence="high", ts=now - timedelta(days=7, hours=12)),
        ])
        session.flush()
        result = forecast(session, route.id, now)
        assert result["points"][0]["score"] > 80
