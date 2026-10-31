from pydantic import BaseModel, ConfigDict, Field


class GPSInput(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "bus_id": 11, "lat": 40.376, "lng": 49.846, "speed_kmh": 18}})
    bus_id: int = Field(gt=0)
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    speed_kmh: float = Field(ge=0, le=130, allow_inf_nan=False)


class CrowdInput(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"route_id": 1, "bus_id": 11, "level": 5}})
    route_id: int = Field(gt=0)
    bus_id: int | None = Field(default=None, gt=0)
    level: int = Field(ge=1, le=5, strict=True)
