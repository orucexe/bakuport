from datetime import datetime, timezone

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class Base(DeclarativeBase):
    pass


def upgrade_stop_columns(engine) -> None:
    """Add optional provenance columns to the initial demo schema without dropping data."""
    columns = {column["name"] for column in inspect(engine).get_columns("stops")}
    with engine.begin() as connection:
        for name, declaration in {"source_id": "VARCHAR(30)", "stop_type": "VARCHAR(150)"}.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE stops ADD COLUMN {name} {declaration}"))


def make_database(url: str):
    if url.startswith(('postgres://', 'postgresql://')):
        url = 'postgresql+psycopg://' + url.split('://', 1)[1]
    options = {}
    if url.startswith("sqlite"):
        options = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in url:
            options["poolclass"] = StaticPool
    engine = create_engine(url, pool_pre_ping=True, **options)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    return engine, sessionmaker(engine, expire_on_commit=False)
