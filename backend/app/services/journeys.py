"""Direct bus journeys and GPS estimates on directional, open polylines."""
import math
from datetime import datetime, timedelta
from fastapi import HTTPException

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from ..db import aware, utcnow
from ..models import Bus, BusPosition, Route, RouteStop, Stop, VehicleGPS
from .eta import haversine
from .official_routes import OfficialRoutes, coordinate, positive_id


def distance(a: dict, b: dict) -> float:
    return haversine((a['lat'], a['lng']), (b['lat'], b['lng']))


def locate(point: dict, path: list[dict]) -> tuple[float, float]:
    """Return progress and offset without inventing a closing segment."""
    best, cumulative = (0.0, float('inf')), 0.0
    scale = math.cos(math.radians(point['lat']))
    for a, b in zip(path, path[1:]):
        ax, ay = (a['lng']-point['lng'])*scale, a['lat']-point['lat']
        dx, dy = (b['lng']-a['lng'])*scale, b['lat']-a['lat']
        fraction = max(0, min(1, -(ax*dx+ay*dy)/max(dx*dx+dy*dy, 1e-15)))
        projected = {'lat':a['lat']+(b['lat']-a['lat'])*fraction, 'lng':a['lng']+(b['lng']-a['lng'])*fraction}
        length, offset = distance(a,b), distance(point,projected)
        if offset < best[1]:
            best = (cumulative+length*fraction,offset)
        cumulative += length
    return best


def point_at(path: list[dict], progress: float) -> dict:
    for a,b in zip(path,path[1:]):
        length = distance(a,b)
        if progress <= length:
            ratio = max(0, progress)/max(length,1e-9)
            return {'lat':a['lat']+(b['lat']-a['lat'])*ratio, 'lng':a['lng']+(b['lng']-a['lng'])*ratio}
        progress -= length
    return path[-1]


def slice_path(path: list[dict], start_km: float, end_km: float) -> list[dict]:
    """Keep the traveled polyline rather than the whole bus line."""
    points = [point_at(path, start_km)]
    progress = 0.0
    for a, b in zip(path, path[1:]):
        progress += distance(a, b)
        if start_km < progress < end_km:
            points.append(b)
    points.append(point_at(path, end_km))
    return points


def match_direction(route: dict, direction: dict, origin: dict, destination: dict, walk_km: float) -> dict | None:
    stops, path = direction['stops'], direction['shape']
    board = [(i, distance(origin,s)) for i,s in enumerate(stops) if distance(origin,s) <= walk_km]
    alight = [(i, distance(destination,s)) for i,s in enumerate(stops) if distance(destination,s) <= walk_km]
    candidates = []
    for start, before in board:
        for end, after in alight:
            if end <= start:
                continue
            start_km, _ = locate(stops[start],path)
            end_km, _ = locate(stops[end],path)
            if end_km <= start_km:
                continue
            ride = (end_km-start_km)/18*60
            candidates.append((before/4.5*60+after/4.5*60+ride, start, end, before, after, ride))
    if not candidates:
        return None
    total,start,end,before,after,ride = min(candidates)
    start_km, _ = locate(stops[start], path)
    end_km, _ = locate(stops[end], path)
    ride_shape = slice_path(path, start_km, end_km)
    before_minutes, after_minutes = before / 4.5 * 60, after / 4.5 * 60
    legs = [
        {'type': 'walk', 'from': origin, 'to': stops[start], 'distance_m': round(before * 1000),
         'minutes': round(before_minutes, 1), 'shape': [origin, stops[start]], 'estimated': True},
        {'type': 'bus', 'from': stops[start], 'to': stops[end], 'code': route['code'],
         'distance_m': round((end_km-start_km)*1000), 'minutes': round(ride, 1), 'shape': ride_shape},
        {'type': 'walk', 'from': stops[end], 'to': destination, 'distance_m': round(after * 1000),
         'minutes': round(after_minutes, 1), 'shape': [stops[end], destination], 'estimated': True},
    ]
    return {'key':f"{route['source_id']}:{direction['id']}", 'route_id':route['source_id'], 'code':route['code'],
            'direction_id':direction['id'], 'direction_label':direction['label'], 'carrier':route['carrier'],
            'tariff_label':route['tariff_label'], 'board':stops[start], 'alight':stops[end],
            'stop_count':end-start, 'walk_to_m':round(before*1000), 'walk_from_m':round(after*1000),
            'ride_minutes':round(ride, 1), 'walk_to_minutes':round(before_minutes, 1),
            'walk_from_minutes':round(after_minutes, 1), 'legs':legs,
            'planned_minutes':math.ceil(total), 'shape':ride_shape,
            'stops':stops, 'stale':route.get('stale',False), 'fetched_at':route.get('fetched_at'),
            'source_url':route.get('source_url'), 'live_available':False}


def normalize_stops(raw: list[dict]) -> dict:
    if not isinstance(raw,list) or not raw:
        raise ValueError('Missing AYNA stops')
    stops=[]
    for item in raw:
        try:
            stops.append({'id':positive_id(item['id']), **coordinate(item['latitude'],item['longitude'])})
        except (ValueError, TypeError, KeyError):
            continue
    if not stops:
        raise ValueError('No valid AYNA stop coordinates')
    return {'stops':stops,'excluded_invalid_stops':len(raw)-len(stops)}


def normalize_stop_buses(raw: list[dict]) -> dict:
    if not isinstance(raw,list):
        raise ValueError('Invalid AYNA stop buses')
    return {'ids':list(dict.fromkeys(positive_id(item['id']) for item in raw))}


def demo_routes(sessions: sessionmaker[Session]) -> list[dict]:
    result=[]
    with sessions() as session:
        for route in session.scalars(select(Route)):
            stops=list(session.scalars(select(Stop).join(RouteStop).where(RouteStop.route_id==route.id).order_by(RouteStop.sequence)))
            path=[{'lat':s.lat,'lng':s.lng} for s in stops]
            result.append({'source_id':route.id,'code':route.code,'carrier':'Simulator','tariff_label':'Demo',
                           'directions':[{'id':1,'label':'Demo dövrəsi','shape':path+path[:1],
                                          'stops':[{'source_id':s.id,'sequence':i+1,'name':s.name,'lat':s.lat,'lng':s.lng} for i,s in enumerate(stops)]}]})
    return result


async def search_journeys(service: OfficialRoutes, sessions: sessionmaker[Session], origin: dict,
                          destination: dict, mode: str, walk_km: float) -> dict:
    limited, stale = False, False
    failed = False
    if mode == 'demo':
        routes = demo_routes(sessions)
    else:
        data=await service.fetch('journey:stops','/api/stop/getAll',normalize_stops)
        stale=data['stale']
        async def nearby_ids(point: dict) -> dict[int, float]:
            nonlocal stale, limited, failed
            nearby=sorted((distance(point,s),s['id']) for s in data['stops'] if distance(point,s)<=walk_km)
            limited |= len(nearby)>24
            ids={}
            for walk_distance, stop_id in nearby[:24]:
                try:
                    response=await service.fetch(f'stop-buses:{stop_id}',f'/api/bus/getBusesByStopId?stopId={stop_id}',normalize_stop_buses)
                except HTTPException as exc:
                    if exc.status_code != 503:
                        raise
                    failed = True
                    continue
                stale |= response['stale']
                for route_id in response['ids']:
                    ids[route_id] = min(ids.get(route_id, float('inf')), walk_distance)
            return ids
        start_ids=await nearby_ids(origin)
        end_ids=await nearby_ids(destination)
        # Membership is candidate discovery only. Validate actual walking access
        # against every ordered stop of each candidate's directional geometry.
        # Union preserves lines omitted by a nearby-stop membership response.
        ids=sorted(start_ids.keys() | end_ids.keys(), key=lambda route_id: (
            route_id not in start_ids or route_id not in end_ids,
            start_ids.get(route_id, walk_km)+end_ids.get(route_id, walk_km), route_id))
        limited |= len(ids)>32
        routes=[]
        for source_id in ids[:32]:
            try:
                routes.append(await service.route(source_id))
            except HTTPException as exc:
                if exc.status_code not in (404, 503):
                    raise
                failed = True
        if failed and not routes:
            raise HTTPException(503, 'Stop or route information unavailable; retry the search')
    matches=[]
    for route in routes:
        for direction in route['directions']:
            match=match_direction(route,direction,origin,destination,walk_km)
            if match:
                match['mode']=mode
                matches.append(match)
    ranked=sorted(matches,key=lambda j:(j['planned_minutes'],j['walk_to_m']+j['walk_from_m']))
    return {'journeys':ranked[:12], 'mode':mode,
            'partial':limited or failed or len(ranked)>12,'stale':stale or any(r.get('stale',False) for r in routes),
            'walking_limit_m':round(walk_km*1000), 'direct_only':True,
            'strategy':'walk_bus_walk', 'walking_geometry':'straight_line_estimate'}


def gps_estimates(sessions: sessionmaker[Session], route_id: int, direction_id: int, direction: dict,
                  board_sequence: int, alight_sequence: int, mode: str, now: datetime | None = None) -> dict | None:
    now=now or utcnow()
    with sessions() as session:
        if mode=='demo':
            rows=session.execute(select(BusPosition,Bus).join(Bus).where(Bus.route_id==route_id,BusPosition.ts>=now-timedelta(minutes=5)).order_by(BusPosition.ts.desc(),BusPosition.id.desc())).all()
            samples=[{'vehicle_id':str(bus.id),'label':bus.plate,'lat':p.lat,'lng':p.lng,'speed_kmh':p.speed_kmh,'ts':aware(p.ts)} for p,bus in rows]
        else:
            rows=session.scalars(select(VehicleGPS).where(VehicleGPS.route_source_id==route_id,VehicleGPS.direction_id==direction_id,VehicleGPS.ts>=now-timedelta(minutes=5)).order_by(VehicleGPS.ts.desc(),VehicleGPS.id.desc()))
            samples=[{'vehicle_id':p.vehicle_id,'label':p.vehicle_id,'lat':p.lat,'lng':p.lng,'speed_kmh':p.speed_kmh,'ts':aware(p.ts)} for p in rows]
    board=next((s for s in direction['stops'] if s['sequence']==board_sequence),None)
    alight=next((s for s in direction['stops'] if s['sequence']==alight_sequence),None)
    if not board or not alight or board_sequence>=alight_sequence:
        return None
    path=direction['shape']
    start_km,_=locate(board,path)
    end_km,_=locate(alight,path)
    vehicles=[]
    seen=set()
    for sample in samples:
        vehicle=sample['vehicle_id']
        if vehicle in seen:
            continue
        seen.add(vehicle)
        if (now-sample['ts']).total_seconds()>30:
            continue
        progress,offset=locate(sample,path)
        if offset>0.3 or progress>start_km+0.02:
            continue
        speeds=[s['speed_kmh'] for s in samples if s['vehicle_id']==vehicle]
        speed=max(5,sum(speeds)/len(speeds)) if speeds else 18
        age_minutes=max(0,(now-sample['ts']).total_seconds()/60)
        eta=round(max(0,(start_km-progress)/speed*60-age_minutes),1)
        vehicles.append({**sample,'speed_kmh':round(speed,1),'eta_minutes':eta,
                         'destination_minutes':round(max(0,(end_km-progress)/speed*60-age_minutes),1),
                         'predictions':[{'minutes':minute,'at':now+timedelta(minutes=minute),**point_at(path,progress+speed*(minute+age_minutes)/60)} for minute in [5,10,15]]})
    return {'vehicles':sorted(vehicles,key=lambda v:v['eta_minutes']),'as_of':now,'freshness_seconds':30,'mode':mode}
