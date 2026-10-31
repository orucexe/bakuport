from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator

from ..models import VehicleGPS
from ..services.journeys import demo_routes, distance, gps_estimates, search_journeys

router=APIRouter(tags=['Journey planner'])


class Point(BaseModel):
    lat:float=Field(ge=-90,le=90)
    lng:float=Field(ge=-180,le=180)


class JourneySearch(BaseModel):
    origin:Point
    destination:Point
    mode:Literal['official','demo']='official'
    walking_limit_m:int=Field(default=800,ge=100,le=1500)

    @model_validator(mode='after')
    def different_places(self) -> 'JourneySearch':
        if distance(self.origin.model_dump(),self.destination.model_dump())<0.03:
            raise ValueError('Origin and destination must be at least 30 meters apart')
        return self


@router.post('/journeys/search', summary='Plan walking, bus and final walking legs',description='Search up to 24 nearby AYNA stops per endpoint and 32 candidate lines. Validate all directional boarding/alighting pairs within the walking limit; rank by combined walk/ride time. Three explicit legs and the traveled bus segment are returned. Walking geometry is a straight-line estimate. No bus transfers; partial coverage is explicit.')
async def search(payload:JourneySearch,request:Request) -> dict:
    return await search_journeys(request.app.state.official_routes,request.app.state.sessions,payload.origin.model_dump(),payload.destination.model_dump(),payload.mode,payload.walking_limit_m/1000)


class GPSFix(Point):
    vehicle_id:str=Field(min_length=1,max_length=40,pattern=r'^[A-Za-z0-9 _-]+$')
    route_source_id:int=Field(gt=0)
    direction_id:int=Field(gt=0)
    speed_kmh:float=Field(ge=0,le=130)


@router.post('/vehicles/gps',status_code=201,summary='Accept an external bus GPS fix',description='Provider adapter input, timestamped on receipt. Not an AYNA live feed. Local prototype has no authentication; configure a trusted provider and access controls before external deployment.')
async def vehicle_gps(payload:GPSFix,request:Request) -> dict:
    route=await request.app.state.official_routes.route(payload.route_source_id)
    if not any(d['id']==payload.direction_id for d in route['directions']):
        raise HTTPException(422,'Unknown direction')
    with request.app.state.sessions() as session:
        fix=VehicleGPS(**payload.model_dump())
        session.add(fix);session.commit()
        result={**payload.model_dump(),'ts':fix.ts}
    await request.app.state.hub.publish('vehicle_gps',result)
    return result


@router.get('/journeys/vehicles',summary='GPS arrivals and predicted positions',description='Fresh fixes (30s), last-five-minute mean speed (floor 5 km/h), route projection and 5/10/15-minute predictions. Predictions are estimates, clamped at the route end; stale/off-route/passed buses are excluded.')
async def vehicles(request:Request,route_id:int=Query(gt=0),direction_id:int=Query(gt=0),board:int=Query(gt=0),alight:int=Query(gt=0),mode:Literal['official','demo']='official') -> dict:
    if mode=='demo':
        route=next((r for r in demo_routes(request.app.state.sessions) if r['source_id']==route_id),None)
    else:
        route=await request.app.state.official_routes.route(route_id)
    direction=next((d for d in route['directions'] if d['id']==direction_id),None) if route else None
    if not direction:
        raise HTTPException(404,'Route direction not found')
    result=gps_estimates(request.app.state.sessions,route_id,direction_id,direction,board,alight,mode)
    if result is None:
        raise HTTPException(422,'Invalid boarding/alighting stop order')
    return result
