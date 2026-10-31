from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import func, select

from ..models import DailyRidership, DataImport
from ..services.open_data import manifest

router = APIRouter(tags=["Open data"])


@router.get("/data/sources", summary="Bundled official data provenance, import counts and limitations")
def sources(request: Request):
    with request.app.state.sessions() as session:
        imports = {row.key: row for row in session.scalars(select(DataImport))}
        result = []
        for key, metadata in manifest().items():
            imported = imports.get(key)
            result.append({"key": key, **metadata, "row_count": imported.row_count if imported else 0,
                           "sha256": imported.sha256 if imported else None,
                           "imported_at": imported.imported_at if imported else None})
        return {"sources": result, "route_stop_mapping_available": False,
                "live_positions": "simulated", "density_history": "synthetic_and_simulated"}


@router.get("/operator/ridership/routes", summary="Real route codes and total recorded daily rides")
def ridership_routes(request: Request):
    with request.app.state.sessions() as session:
        rows = session.execute(select(DailyRidership.route_code, func.sum(DailyRidership.rides),
            func.count(), func.min(DailyRidership.date), func.max(DailyRidership.date))
            .group_by(DailyRidership.route_code).order_by(func.sum(DailyRidership.rides).desc())).all()
        return [{"route_code": code, "total_rides": total, "recorded_days": count,
                 "first_date": first, "last_date": last} for code, total, count, first, last in rows]


@router.get("/operator/ridership/{route_code}", summary="Actual daily payment validations; not occupancy",
            description="Example: /operator/ridership/62?days=30. Window ends on the latest date actually present in the dataset, not today's date. Missing dates are omitted rather than filled with invented zeros.")
def ridership_history(route_code: str, request: Request, days: int = Query(30, ge=7, le=366)):
    with request.app.state.sessions() as session:
        latest = session.scalar(select(func.max(DailyRidership.date)).where(DailyRidership.route_code == route_code))
        if latest is None:
            raise HTTPException(404, "No published ridership data for this route")
        rows = list(session.scalars(select(DailyRidership).where(DailyRidership.route_code == route_code,
            DailyRidership.date >= latest - timedelta(days=days - 1)).order_by(DailyRidership.date)))
        total = sum(row.rides for row in rows)
        return {"route_code": route_code, "source_url": manifest()["ridership"]["dataset_url"],
                "first_date": rows[0].date, "last_date": latest, "recorded_days": len(rows),
                "total_rides": total, "average_daily_rides": round(total / len(rows)),
                "latest_daily_rides": rows[-1].rides,
                "points": [{"date": row.date, "rides": row.rides} for row in rows],
                "measurement": "daily_payment_validations", "live": False}
