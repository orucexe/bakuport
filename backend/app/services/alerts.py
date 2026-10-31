from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import aware
from ..models import Alert, Route


def fallback_recommendation(route: Route, window: float) -> str:
    return (f"{route.code} marşrutunda {window:g} dəqiqədir yüksək sıxlıq müşahidə olunur. "
            "2 əlavə avtobus ayırın və hərəkət intervalını azaldın; təsiri növbəti 10 dəqiqədə izləyin.")


def evaluate_alert(session: Session, route: Route, score: float, now: datetime,
                   settings: Settings, available: bool = True) -> tuple[str, Alert] | None:
    alert = session.scalar(select(Alert).where(Alert.route_id == route.id, Alert.status == "open"))
    # Missing observations or a worker outage cannot establish continuous density.
    if route.evaluated_at and (now - aware(route.evaluated_at)).total_seconds() > 90:
        route.high_since = route.low_since = None
    route.evaluated_at = now
    if not available:
        route.high_since = route.low_since = None
        return None
    if score >= settings.density_threshold:
        route.low_since = None
        route.high_since = route.high_since or now
        if alert is None and now - aware(route.high_since) >= timedelta(minutes=settings.effective_alert_minutes):
            alert = Alert(route_id=route.id, started_at=now, status="open",
                          message=f"{route.code}: {settings.effective_alert_minutes:g} dəqiqə davamlı yüksək sıxlıq",
                          ai_recommendation=fallback_recommendation(route, settings.effective_alert_minutes))
            session.add(alert)
            session.flush()
            return "alert_created", alert
    else:
        route.high_since = None
        if alert and score < settings.density_threshold - settings.alert_hysteresis:
            route.low_since = route.low_since or now
            if now - aware(route.low_since) >= timedelta(minutes=settings.resolve_window_minutes):
                alert.status = "resolved"
                alert.resolved_at = now
                route.low_since = None
                return "alert_resolved", alert
        else:
            route.low_since = None
    return None
