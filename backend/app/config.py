from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://idda:idda_local_demo@localhost:5432/idda"
    demo_mode: bool = False
    load_open_data: bool = True
    ayna_api_url: str = "https://map-api.ayna.gov.az"
    ayna_cache_hours: float = Field(24, ge=1, le=168)
    density_threshold: float = Field(70, ge=1, le=100)
    alert_window_minutes: float = Field(10, gt=0)
    alert_hysteresis: float = Field(10, ge=0)
    resolve_window_minutes: float = Field(2, gt=0)
    crowd_weight: float = Field(0.6, ge=0)
    gps_weight: float = Field(0.4, ge=0)
    green_threshold: float = Field(40, ge=0, le=100)
    red_threshold: float = Field(70, ge=0, le=100)
    llm_api_key: str = ""
    llm_model: str = "claude-haiku-4-5"

    @model_validator(mode="after")
    def valid_weights(self):
        if abs(self.crowd_weight + self.gps_weight - 1) > 0.0001:
            raise ValueError("Density weights must sum to 1")
        if self.green_threshold >= self.red_threshold:
            raise ValueError("Green threshold must be below red threshold")
        if self.alert_hysteresis >= self.density_threshold:
            raise ValueError("Hysteresis must be below the alert threshold")
        return self

    @property
    def effective_alert_minutes(self) -> float:
        return 1 if self.demo_mode else self.alert_window_minutes
