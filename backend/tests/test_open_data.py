from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, inspect, select, text

from app.config import Settings
from app.db import upgrade_stop_columns
from app.main import create_app
from app.models import CrowdReport, DailyRidership, DataImport, RouteStop, Stop
from app.services.open_data import DATA_DIR, import_open_data, read_ridership, read_stops


def test_real_csv_counts_coordinates_and_leading_zero_identifiers():
    stops = read_stops(DATA_DIR / "dayanacaqlar.csv")
    rides = read_ridership(DATA_DIR / "bakubus_passenger-2026.csv")
    assert len(stops) == 3600
    assert len(rides) == 15686
    assert len({row["route_code"] for row in rides}) == 65
    assert max(row["date"] for row in rides) == date(2026, 9, 30)
    first = next(stop for stop in stops if stop["source_id"] == "001003892")
    assert first["id"] == 1003892 and first["lat"] == 40.498112 and first["lng"] == 50.206297
    assert next(row for row in rides if row["route_code"] == "5" and row["date"] == date(2026, 1, 1))["rides"] == 12030


def test_microdegree_input_duplicate_header_and_bad_rows(tmp_path):
    path = tmp_path / "stops.csv"
    path.write_text('ID,AD,ID,LONGITUDE,LATITUDE,Tip\n1,Test,001000001,49848000,40384000,\n', encoding='utf-8')
    assert read_stops(path)[0]["lat"] == 40.384
    path.write_text('ID,AD,ID,LONGITUDE,LATITUDE,Tip\n1,Test,001000001,nan,40.3,\n', encoding='utf-8')
    with pytest.raises(ValueError):
        read_stops(path)
    path.write_text('Date,Marşrutun adı,Count\n2026-01-01 00:00:00,5,-1\n', encoding='utf-8')
    with pytest.raises(ValueError):
        read_ridership(path)


def test_existing_schema_upgrade_preserves_old_stop(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE stops (id INTEGER PRIMARY KEY, name VARCHAR(150), lat FLOAT, lng FLOAT)'))
        connection.execute(text("INSERT INTO stops VALUES (101, 'Legacy', 40.38, 49.85)"))
    upgrade_stop_columns(engine)
    upgrade_stop_columns(engine)
    assert {c['name'] for c in inspect(engine).get_columns('stops')} >= {'source_id', 'stop_type'}
    with engine.connect() as connection:
        assert connection.execute(text('SELECT name FROM stops WHERE id=101')).scalar() == 'Legacy'
    engine.dispose()


def test_import_into_existing_demo_preserves_reports_and_is_idempotent(client):
    client.post('/crowd-reports', json={"route_id": 1, "level": 5})
    with client.app.state.sessions() as session:
        import_open_data(session)
        assert session.scalar(select(func.count(Stop.id)).where(Stop.source_id.is_not(None))) == 3600
        assert session.scalar(select(func.count(DailyRidership.route_code))) == 15686
        assert session.scalar(select(func.count(CrowdReport.id))) == 1
        assert session.scalar(select(func.count(DataImport.key))) == 2
        assert session.scalar(select(Stop.source_id).join(RouteStop).where(RouteStop.route_id == 1).limit(1))
        mappings = list(session.execute(select(RouteStop.route_id, RouteStop.stop_id, RouteStop.sequence)))
        import_open_data(session)
        assert list(session.execute(select(RouteStop.route_id, RouteStop.stop_id, RouteStop.sequence))) == mappings
        assert session.scalar(select(func.count(DailyRidership.route_code))) == 15686
    routes = client.get('/operator/ridership/routes').json()
    assert len(routes) == 65 and routes[0]['route_code'] == '62'
    assert routes[0]['total_rides'] == 5313239
    history = client.get('/operator/ridership/62?days=30').json()
    assert history['last_date'] == '2026-09-30' and history['first_date'] == '2026-09-01'
    assert sum(point['rides'] for point in history['points']) == history['total_rides']
    assert not history['live'] and history['measurement'] == 'daily_payment_validations'
    assert client.get('/operator/ridership/DOES-NOT-EXIST').status_code == 404
    assert client.get('/operator/ridership/62?days=0').status_code == 422
    provenance = client.get('/data/sources').json()
    assert provenance['route_stop_mapping_available']
    assert not provenance['csv_route_stop_mapping_available']
    assert provenance['sources'][0]['row_count'] == 3600


def test_default_startup_loads_official_stops_and_still_supports_eta(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'official.db'}", demo_mode=True, load_open_data=True, _env_file=None)
    with TestClient(create_app(settings)) as client:
        assert len(client.get('/stops').json()) == 3600
        stop = client.get('/routes/1/stops').json()[0]
        assert stop['source_id'] and not stop['name'].startswith('DEMO-')
        assert client.post('/gps', json={'bus_id': 11, 'lat': stop['lat'], 'lng': stop['lng'], 'speed_kmh': 18}).status_code == 201
        assert client.get(f"/stops/{stop['id']}/arrivals").json()[0]['eta_minutes'] == 0
