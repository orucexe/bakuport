import pytest


def test_gps_to_arrivals_and_live_event(client):
    stop = client.get("/routes/1/stops").json()[0]
    with client.websocket_connect("/ws/live") as websocket:
        response = client.post("/gps", json={"bus_id": 11, "lat": stop["lat"], "lng": stop["lng"], "speed_kmh": 18})
        assert response.status_code == 201
        assert websocket.receive_json()["type"] == "bus_position"
    arrivals = client.get(f'/stops/{stop["id"]}/arrivals').json()
    assert arrivals[0]["bus_id"] == 11
    assert arrivals[0]["eta_minutes"] == 0
    assert client.get("/routes/1/buses").json()[0]["position"] is not None


@pytest.mark.parametrize("level", [0, 6, 1.5, "5", True])
def test_crowd_validation(client, level):
    assert client.post("/crowd-reports", json={"route_id": 1, "bus_id": 11, "level": level}).status_code == 422


def test_crowd_route_membership_and_unknown_ids(client):
    assert client.post("/crowd-reports", json={"route_id": 1, "bus_id": 21, "level": 5}).status_code == 422
    assert client.post("/crowd-reports", json={"route_id": 1, "level": 5}).status_code == 201
    assert client.get("/routes/999").status_code == 404
    assert client.get("/stops/999/arrivals").status_code == 404
    assert client.post("/gps", json={"bus_id": 999, "lat": 40, "lng": 49, "speed_kmh": 18}).status_code == 404
    assert client.post("/gps", json={"bus_id": 11, "lat": 91, "lng": 49, "speed_kmh": 18}).status_code == 422


def test_density_surge_history_and_docs(client):
    assert client.get("/health").json()["alert_window_minutes"] == 1
    density = client.get("/operator/density").json()
    assert len(density) == 3 and all(d["confidence"] == "unavailable" for d in density)
    history = client.get("/operator/density/1/history").json()
    assert any(d["synthetic"] for d in history)
    assert client.post("/demo/surge?route_id=1&level=5").json()["active"]
    assert client.get("/routes/1").json()["surge_level"] == 5
    assert not client.post("/demo/surge?route_id=1&level=0").json()["active"]
    assert client.get("/operator/alerts?status=invalid").status_code == 422
    assert client.get("/docs").status_code == 200
    assert "/crowd-reports" in client.get("/openapi.json").json()["paths"]


def test_demo_controls_disabled_in_normal_mode(client):
    client.app.state.settings.demo_mode = False
    assert client.post("/demo/surge?route_id=1&level=5").status_code == 403
