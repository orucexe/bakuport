import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import Settings
from .db import Base, make_database, upgrade_stop_columns, utcnow
from .live import LiveHub
from .models import Alert, Bus, BusPosition, Route, RouteStop, Stop
from .schemas import BusOutput, GPSInput, GPSOutput, HealthOutput, RouteOutput, StopOutput
from .seed import seed
from .routers.analytics import router as analytics_router
from .services.engine import alert_payload, calculate_tick
from .services.ai import recommendation
from .services.open_data import import_open_data
from .routers.open_data import router as open_data_router
from .routers.official_routes import router as official_routes_router
from .services.official_routes import OfficialRoutes, bootstrap_official_cache

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine, sessions = make_database(settings.database_url)
    hub = LiveHub()
    recommendation_tasks: set[asyncio.Task] = set()
    official_routes = OfficialRoutes(sessions, settings)

    @asynccontextmanager
    async def lifespan(app):
        Base.metadata.create_all(engine)
        upgrade_stop_columns(engine)
        with sessions() as session:
            seed(session)
            if settings.load_open_data:
                import_open_data(session)
            bootstrap_official_cache(session)
        await run_tick()
        app.state.next_tick = time.monotonic() + 60
        task = asyncio.create_task(analytics_loop())
        try:
            yield
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            for pending in recommendation_tasks:
                pending.cancel()
            await asyncio.gather(*recommendation_tasks, return_exceptions=True)
            await official_routes.client.aclose()
            engine.dispose()

    async def improve_recommendation(alert_id: int, route_id: int):
        try:
            with sessions() as session:
                route = session.get(Route, route_id)
            message, source = await recommendation(route, settings)
            if source == "template":
                return
            with sessions() as session:
                alert = session.get(Alert, alert_id)
                alert.ai_recommendation = message
                alert.recommendation_source = source
                session.commit()
                payload = alert_payload(alert)
            await hub.publish("alert_updated", payload)
        except Exception:
            log.exception("Recommendation update failed; saved template retained")

    async def run_tick():
        events = await asyncio.to_thread(calculate_tick, sessions, settings, utcnow())
        for event_type, data in events:
            await hub.publish(event_type, data)
            if event_type == "alert_created" and settings.llm_api_key:
                pending = asyncio.create_task(improve_recommendation(data["id"], data["route_id"]))
                recommendation_tasks.add(pending)
                pending.add_done_callback(recommendation_tasks.discard)

    async def analytics_loop():
        while True:
            await asyncio.sleep(1)
            if time.monotonic() >= app.state.next_tick:
                try:
                    await run_tick()
                except Exception:
                    log.exception("Analytics tick failed; retaining previous state")
                app.state.next_tick = time.monotonic() + 60

    app = FastAPI(title="IDDA · Smart Transit Demo", lifespan=lifespan)
    app.state.sessions = sessions
    app.state.settings = settings
    app.state.official_routes = official_routes
    app.state.hub = hub
    app.state.next_tick = time.monotonic() + 60
    app.state.run_tick = run_tick
    app.include_router(analytics_router)
    app.include_router(open_data_router)
    app.include_router(official_routes_router)
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

    @app.get("/health", response_model=HealthOutput, tags=["System"], summary="Database readiness and demo configuration")
    def health():
        with sessions() as session:
            session.execute(select(1))
        return {"status": "ok", "demo_mode": settings.demo_mode,
                "alert_window_minutes": settings.effective_alert_minutes,
                "green_threshold": settings.green_threshold, "red_threshold": settings.red_threshold,
                "density_threshold": settings.density_threshold}

    @app.get("/routes", response_model=list[RouteOutput], tags=["Routes"], summary="List fictional Baku demo routes")
    def routes():
        with sessions() as session:
            return list(session.scalars(select(Route).order_by(Route.id)))

    @app.get("/routes/{route_id}", response_model=RouteOutput, tags=["Routes"], summary="Get a demo route")
    def route(route_id: int):
        with sessions() as session:
            result = session.get(Route, route_id)
            if result is None:
                raise HTTPException(404, "Route not found")
            return result

    @app.get("/routes/{route_id}/stops", response_model=list[StopOutput], tags=["Routes"], summary="Ordered route stops")
    def stops_on_route(route_id: int):
        route(route_id)
        with sessions() as session:
            return list(session.scalars(select(Stop).join(RouteStop).where(RouteStop.route_id == route_id)
                                        .order_by(RouteStop.sequence)))

    @app.get("/stops", response_model=list[StopOutput], tags=["Stops"], summary="List demo stops")
    def stops():
        with sessions() as session:
            query = select(Stop).order_by(Stop.id)
            if settings.load_open_data:
                query = query.where(Stop.source_id.is_not(None))
            return list(session.scalars(query))

    @app.get("/routes/{route_id}/buses", response_model=list[BusOutput], tags=["Routes"], summary="Buses with latest live positions")
    def buses(route_id: int):
        route(route_id)
        with sessions() as session:
            result = []
            for bus in session.scalars(select(Bus).where(Bus.route_id == route_id)):
                position = session.scalar(select(BusPosition).where(BusPosition.bus_id == bus.id)
                                          .order_by(BusPosition.ts.desc(), BusPosition.id.desc()).limit(1))
                result.append({"id": bus.id, "route_id": route_id, "plate": bus.plate,
                               "capacity": bus.capacity, "position": position})
            return result

    @app.post("/gps", response_model=GPSOutput, tags=["Ingestion"], status_code=201, summary="Ingest a server-timestamped GPS fix")
    async def gps(payload: GPSInput):
        with sessions() as session:
            bus = session.get(Bus, payload.bus_id)
            if bus is None:
                raise HTTPException(404, "Bus not found")
            position = BusPosition(**payload.model_dump())
            session.add(position)
            session.commit()
            result = {"bus_id": bus.id, "route_id": bus.route_id, "lat": position.lat,
                      "lng": position.lng, "speed_kmh": position.speed_kmh, "ts": position.ts}
        await hub.publish("bus_position", result)
        return result

    @app.websocket("/ws/live")
    async def live(socket: WebSocket):
        await hub.connect(socket)

    return app


app = create_app()
