from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, JSON, String, text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, utcnow


class Route(Base):
    __tablename__ = "routes"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    color: Mapped[str] = mapped_column(String(7))
    surge_level: Mapped[int] = mapped_column(default=0)
    scenario_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    high_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    low_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Stop(Base):
    __tablename__ = "stops"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    lat: Mapped[float]
    lng: Mapped[float]
    source_id: Mapped[str | None] = mapped_column(String(30))
    stop_type: Mapped[str | None] = mapped_column(String(150))


class DailyRidership(Base):
    __tablename__ = "daily_ridership"
    route_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    rides: Mapped[int]
    __table_args__ = (CheckConstraint("rides >= 0"),)


class DataImport(Base):
    __tablename__ = "data_imports"
    key: Mapped[str] = mapped_column(String(30), primary_key=True)
    sha256: Mapped[str] = mapped_column(String(64))
    row_count: Mapped[int]
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OfficialRouteCache(Base):
    __tablename__ = "official_route_cache"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    source_url: Mapped[str] = mapped_column(String(500))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RouteStop(Base):
    __tablename__ = "route_stops"
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), primary_key=True)
    stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id"), primary_key=True)
    sequence: Mapped[int]
    __table_args__ = (Index("uq_route_sequence", "route_id", "sequence", unique=True),)


class Bus(Base):
    __tablename__ = "buses"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True)
    plate: Mapped[str] = mapped_column(String(20), unique=True)
    capacity: Mapped[int] = mapped_column(default=80)


class BusPosition(Base):
    __tablename__ = "bus_positions"
    id: Mapped[int] = mapped_column(primary_key=True)
    bus_id: Mapped[int] = mapped_column(ForeignKey("buses.id"))
    lat: Mapped[float]
    lng: Mapped[float]
    speed_kmh: Mapped[float]
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (Index("ix_bus_positions_bus_ts", "bus_id", "ts"),)


class VehicleGPS(Base):
    __tablename__ = "vehicle_gps"
    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(String(40))
    route_source_id: Mapped[int]
    direction_id: Mapped[int]
    lat: Mapped[float]
    lng: Mapped[float]
    speed_kmh: Mapped[float]
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (Index("ix_vehicle_gps_route_time", "route_source_id", "direction_id", "ts"),)


class CrowdReport(Base):
    __tablename__ = "crowd_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    bus_id: Mapped[int | None] = mapped_column(ForeignKey("buses.id"))
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True)
    level: Mapped[int]
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    __table_args__ = (CheckConstraint("level BETWEEN 1 AND 5"),)


class DensitySnapshot(Base):
    __tablename__ = "density_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"))
    score: Mapped[float]
    confidence: Mapped[str] = mapped_column(String(20), default="low")
    synthetic: Mapped[bool] = mapped_column(default=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (CheckConstraint("score BETWEEN 0 AND 100"), Index("ix_density_route_ts", "route_id", "ts"))


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"))
    type: Mapped[str] = mapped_column(String(30), default="high_density")
    status: Mapped[str] = mapped_column(String(20), default="open")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    message: Mapped[str]
    ai_recommendation: Mapped[str] = mapped_column(default="")
    recommendation_source: Mapped[str] = mapped_column(String(20), default="template")
    __table_args__ = (Index("uq_open_alert_per_route", "route_id", unique=True,
                            postgresql_where=text("status = 'open'"), sqlite_where=text("status = 'open'")),)
