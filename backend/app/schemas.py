from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GPSInput(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "bus_id": 11, "lat": 40.384, "lng": 49.848, "speed_kmh": 18}})
    bus_id: int = Field(gt=0)
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    speed_kmh: float = Field(ge=0, le=130, allow_inf_nan=False)


class CrowdInput(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"route_id": 1, "bus_id": 11, "level": 5}})
    route_id: int | None = Field(default=None, gt=0)
    route_code: str | None = Field(default=None, max_length=50)
    bus_id: int | None = Field(default=None, gt=0)
    level: int = Field(ge=1, le=5, strict=True)


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RouteOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": 1, "code": "1", "name": "Koroğlu NMM — Neftçilər — Mərdəkan (BakuBus)", "color": "#0284c7", "surge_level": 0}})
    id: int
    code: str
    name: str
    color: str
    surge_level: int


class StopOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": 101, "name": "Koroğlu NMM", "lat": 40.4205, "lng": 49.9185}})
    id: int
    name: str
    lat: float
    lng: float
    source_id: str | None = None
    stop_type: str | None = None


class PositionOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": 1, "bus_id": 11, "lat": 40.384, "lng": 49.848, "speed_kmh": 18, "ts": "2026-10-31T08:00:00Z"}})
    id: int
    bus_id: int
    lat: float
    lng: float
    speed_kmh: float
    ts: datetime


class BusOutput(Output):
    id: int
    route_id: int
    plate: str
    capacity: int
    position: PositionOutput | None


class GPSOutput(GPSInput):
    model_config = ConfigDict(json_schema_extra={"example": {
        "bus_id": 11, "route_id": 1, "lat": 40.384, "lng": 49.848, "speed_kmh": 18, "ts": "2026-10-31T08:00:00Z"}})
    route_id: int
    ts: datetime


class CrowdOutput(CrowdInput):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": 1, "route_id": 1, "bus_id": 11, "level": 5, "ts": "2026-10-31T08:00:00Z"}})
    id: int
    ts: datetime


Level = Literal["low", "medium", "high", "unknown"]


class ArrivalOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {
        "bus_id": 11, "route_id": 1, "plate": "99-JH-101", "eta_minutes": 3.5,
        "crowd_score": 100, "crowd_level": "high", "confidence": "reported", "ts": "2026-10-31T08:00:00Z"}})
    bus_id: int
    route_id: int
    plate: str
    eta_minutes: float
    crowd_score: float | None
    crowd_level: Level
    confidence: str
    ts: datetime


class DensityOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {
        "route_id": 1, "score": 85, "confidence": "high", "synthetic": False, "level": "high", "ts": "2026-10-31T08:00:00Z"}})
    route_id: int
    score: float
    confidence: str
    synthetic: bool
    ts: datetime
    level: Level


class AlertOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": 1, "route_id": 1, "type": "high_density", "status": "open", "started_at": "2026-10-31T08:00:00Z",
        "resolved_at": None, "message": "1: 10 dəqiqə davamlı yüksək sıxlıq",
        "ai_recommendation": "2 əlavə avtobus ayırın və hərəkət intervalını azaldın.", "recommendation_source": "template"}})
    id: int
    route_id: int
    type: str
    status: Literal["open", "resolved"]
    started_at: datetime
    resolved_at: datetime | None
    message: str
    ai_recommendation: str
    recommendation_source: Literal["template", "llm"]


class ForecastPoint(Output):
    ts: datetime
    score: float


class ForecastOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {
        "route_id": 1, "method": "seasonal_hour_weekday", "synthetic_history": True, "insufficient_data": False,
        "points": [{"ts": f"2026-10-31T08:{minute:02}:00Z", "score": 45} for minute in [15, 30, 45]]
                  + [{"ts": "2026-10-31T09:00:00Z", "score": 40}]}})
    route_id: int
    method: str
    synthetic_history: bool
    insufficient_data: bool
    points: list[ForecastPoint]


class SurgeOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {"route_id": 1, "level": 5, "active": True}})
    route_id: int
    level: int
    active: bool


class HealthOutput(Output):
    model_config = ConfigDict(json_schema_extra={"example": {"status": "ok", "demo_mode": True,
        "alert_window_minutes": 1, "green_threshold": 40, "red_threshold": 70, "density_threshold": 70}})
    status: str
    demo_mode: bool
    alert_window_minutes: float
    green_threshold: float
    red_threshold: float
    density_threshold: float
