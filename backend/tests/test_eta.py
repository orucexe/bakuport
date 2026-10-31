import pytest

from app.services.eta import eta_minutes, haversine, project_to_route

STOPS = [(40.0, 49.0), (40.01, 49.0), (40.01, 49.01), (40.0, 49.01)]


def test_eta_follows_segments_instead_of_direct_distance():
    expected = (haversine(STOPS[0], STOPS[1]) + haversine(STOPS[1], STOPS[2])) / 18 * 60
    assert eta_minutes(STOPS[0], STOPS, 2, []) == pytest.approx(expected, abs=0.05)


def test_projection_handles_mid_segment_and_passed_stop():
    point = (40.005, 49.0)
    assert project_to_route(point, STOPS).progress_km == pytest.approx(haversine(STOPS[0], point), rel=0.001)
    assert eta_minutes(point, STOPS, 0, [18]) is None
    assert eta_minutes(point, STOPS, 1, [18]) > 0


def test_speed_floor_smoothing_and_default():
    assert eta_minutes(STOPS[0], STOPS, 1, [0]) == eta_minutes(STOPS[0], STOPS, 1, [5])
    assert eta_minutes(STOPS[0], STOPS, 1, [10, 20]) == eta_minutes(STOPS[0], STOPS, 1, [15])
    assert eta_minutes(STOPS[0], STOPS, 1, []) == eta_minutes(STOPS[0], STOPS, 1, [18])


def test_at_stop_and_off_route():
    assert eta_minutes(STOPS[1], STOPS, 1, [18]) == 0
    assert eta_minutes((41, 50), STOPS, 1, [18]) is None
    assert eta_minutes(STOPS[3], STOPS, 1, [18]) is None
