from datetime import timedelta

from sqlalchemy import select

from app.db import Base, make_database, utcnow
from app.models import Alert, Route
from app.services.alerts import evaluate_alert


def setup_route():
    engine, sessions = make_database("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessions()
    route = Route(code="DEMO-A", name="Demo", color="#087f8c")
    session.add(route)
    session.commit()
    return engine, session, route


def test_ten_minutes_no_duplicates_hysteresis_and_resolve(settings):
    engine, session, route = setup_route()
    now = utcnow()
    try:
        for minute in range(10):
            assert evaluate_alert(session, route, 70, now + timedelta(minutes=minute), settings) is None
        event, alert = evaluate_alert(session, route, 70, now + timedelta(minutes=10), settings)
        session.commit()
        assert event == "alert_created"
        assert evaluate_alert(session, route, 90, now + timedelta(minutes=11), settings) is None
        assert len(list(session.scalars(select(Alert)))) == 1
        assert evaluate_alert(session, route, 59, now + timedelta(minutes=12), settings) is None
        # A reading at the recovery threshold interrupts the recovery streak.
        assert evaluate_alert(session, route, 60, now + timedelta(minutes=13), settings) is None
        assert evaluate_alert(session, route, 50, now + timedelta(minutes=14), settings) is None
        assert evaluate_alert(session, route, 50, now + timedelta(minutes=15), settings) is None
        event, resolved = evaluate_alert(session, route, 50, now + timedelta(minutes=16), settings)
        assert event == "alert_resolved"
        assert resolved.id == alert.id and resolved.resolved_at is not None
        session.commit()
    finally:
        session.close()
        engine.dispose()


def test_low_reading_missing_data_and_restart_gap_reset_streak(settings):
    engine, session, route = setup_route()
    now = utcnow()
    try:
        for minute in range(10):
            evaluate_alert(session, route, 90, now + timedelta(minutes=minute), settings)
        evaluate_alert(session, route, 69, now + timedelta(minutes=10), settings)
        assert route.high_since is None
        evaluate_alert(session, route, 90, now + timedelta(minutes=11), settings)
        evaluate_alert(session, route, 90, now + timedelta(minutes=12), settings, available=False)
        assert route.high_since is None
        evaluate_alert(session, route, 90, now + timedelta(minutes=13), settings)
        assert evaluate_alert(session, route, 90, now + timedelta(minutes=24), settings) is None
        assert route.high_since == now + timedelta(minutes=24)
    finally:
        session.close()
        engine.dispose()


def test_demo_window_is_one_minute_and_state_survives_session(settings):
    settings.demo_mode = True
    engine, session, route = setup_route()
    now = utcnow()
    try:
        evaluate_alert(session, route, 90, now, settings)
        session.commit()
        session.expire_all()
        assert evaluate_alert(session, route, 90, now + timedelta(seconds=59), settings) is None
        event, _ = evaluate_alert(session, route, 90, now + timedelta(seconds=60), settings)
        assert event == "alert_created"
    finally:
        session.close()
        engine.dispose()
