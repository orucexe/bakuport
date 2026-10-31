from datetime import timedelta

import pytest

from app.db import utcnow
from app.services.density import density_label, density_score


def test_weighted_score_and_recency(settings):
    now = utcnow()
    score, confidence = density_score([(5, now)], [0], [150], now, settings)
    assert score == 100
    assert confidence == "high"
    score, _ = density_score([(1, now - timedelta(minutes=4)), (5, now)], [18], [0], now, settings)
    assert score > 50


def test_stale_reports_gps_only_and_no_data(settings):
    now = utcnow()
    assert density_score([(5, now - timedelta(minutes=6))], [0], [0], now, settings) == (70, "low")
    assert density_score([], [], [], now, settings) == (0, "unavailable")
    assert density_score([(5, now)], [], [], now, settings) == (100, "medium")


@pytest.mark.parametrize("score,label", [(39.9, "low"), (40, "medium"), (69.9, "medium"), (70, "high")])
def test_color_boundaries(settings, score, label):
    assert density_label(score, settings) == label
