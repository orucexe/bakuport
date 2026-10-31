import logging
import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select

from ..config import Settings
from ..db import aware
from ..models import DensitySnapshot, Route
from .alerts import fallback_recommendation

log = logging.getLogger(__name__)
BAKU = ZoneInfo("Asia/Baku")


async def recommendation(route: Route, settings: Settings,
                         transport: httpx.AsyncBaseTransport | None = None) -> tuple[str, str]:
    fallback = fallback_recommendation(route, settings.effective_alert_minutes)
    if not settings.llm_api_key:
        return fallback, "template"
    try:
        async with httpx.AsyncClient(timeout=10, transport=transport) as client:
            response = await client.post("https://api.anthropic.com/v1/messages", headers={
                "x-api-key": settings.llm_api_key, "anthropic-version": "2023-06-01",
            }, json={"model": settings.llm_model, "max_tokens": 220,
                     "system": "You advise a transit operator in a fictional hackathon demo. Reply in Azerbaijani in at most two short sentences. Suggest additional buses or shorter headway. Do not claim access to real traffic data.",
                     "messages": [{"role": "user", "content": fallback}]})
            response.raise_for_status()
            content = response.json()["content"]
            answer = " ".join(block["text"] for block in content if block.get("type") == "text").strip()
            if answer:
                return answer[:1500], "llm"
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        log.warning("Recommendation provider failed; using local template")
    return fallback, "template"


def forecast(session, route_id: int, now: datetime) -> dict:
    rows = list(session.scalars(select(DensitySnapshot).where(
        DensitySnapshot.route_id == route_id, DensitySnapshot.ts >= now - timedelta(days=14),
        DensitySnapshot.ts <= now, DensitySnapshot.confidence != "unavailable").order_by(DensitySnapshot.ts)))
    local_rows = [(row, aware(row.ts).astimezone(BAKU)) for row in rows]

    def seasonal(target: datetime) -> float:
        local = target.astimezone(BAKU)
        hour = local.hour + local.minute / 60
        weighted = []
        for row, stamp in local_rows:
            gap = abs(hour - (stamp.hour + stamp.minute / 60))
            gap = min(gap, 24 - gap)
            day_weight = 3 if stamp.weekday() == local.weekday() else 1
            weight = math.exp(-0.5 * (gap / 1.5) ** 2) * day_weight
            weighted.append((row.score, weight))
        total = sum(weight for _, weight in weighted)
        return sum(value * weight for value, weight in weighted) / total if total else 0

    measured = [row for row in rows if not row.synthetic and (now - aware(row.ts)).total_seconds() <= 120]
    adjustment = (measured[-1].score - seasonal(now)) * 0.35 if measured else 0
    points = []
    for minutes in (15, 30, 45, 60):
        target = now + timedelta(minutes=minutes)
        score = seasonal(target) + adjustment * math.exp(-minutes / 60)
        points.append({"ts": target, "score": round(max(0, min(100, score)), 1)})
    return {"route_id": route_id, "method": "seasonal_hour_weekday", "synthetic_history": any(row.synthetic for row in rows),
            "insufficient_data": not rows, "points": points}
