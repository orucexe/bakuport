import math
from datetime import datetime

from ..config import Settings
from ..db import aware


def density_score(reports: list[tuple[int, datetime]], speeds: list[float], dwell_seconds: list[float],
                  now: datetime, settings: Settings) -> tuple[float, str]:
    recent = [(level, max(0, (now - aware(ts)).total_seconds())) for level, ts in reports
              if 0 <= (now - aware(ts)).total_seconds() <= 300]
    weights = [math.exp(-age / 120) for _, age in recent]
    crowd = (sum((level - 1) * 25 * weight for (level, _), weight in zip(recent, weights)) / sum(weights)
             if recent else None)
    gps = None
    if speeds:
        slowdown = max(0, min(1, 1 - sum(speeds) / len(speeds) / 18))
        dwell = sum(min(1, max(0, seconds - 30) / 120) for seconds in dwell_seconds) / max(1, len(dwell_seconds))
        gps = min(100, 100 * (0.7 * slowdown + 0.3 * dwell))
    if crowd is not None and gps is not None:
        return round(settings.crowd_weight * crowd + settings.gps_weight * gps, 1), "high"
    if crowd is not None:
        return round(crowd, 1), "medium"
    if gps is not None:
        return round(gps, 1), "low"
    return 0.0, "unavailable"


def density_label(score: float, settings: Settings) -> str:
    if score >= settings.red_threshold:
        return "high"
    if score >= settings.green_threshold:
        return "medium"
    return "low"
