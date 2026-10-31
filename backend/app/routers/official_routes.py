from typing import Annotated

from fastapi import APIRouter, Path, Request

router = APIRouter(prefix="/official", tags=["Official AYNA routes"])


@router.get("/routes", summary="Actual route catalog from the official AYNA map",
            description="Read-only public metadata with persistent 24-hour cache and source/fetch timestamps. These are routes, not live vehicles.")
async def routes(request: Request):
    return await request.app.state.official_routes.catalog()


@router.get("/routes/{source_id}", summary="Official path, stops, directions, carrier and fare",
            description="Example: /official/routes/1. AYNA identifiers are separate from local demo route IDs. No GPS, occupancy or ETA is invented.")
async def route(source_id: Annotated[int, Path(gt=0)], request: Request):
    return await request.app.state.official_routes.route(source_id)
