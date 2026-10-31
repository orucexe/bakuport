from datetime import timedelta
import asyncio
from fastapi import HTTPException

from app.db import utcnow
from app.models import BusPosition, VehicleGPS
from app.services.journeys import gps_estimates, locate, match_direction, point_at, normalize_stops, search_journeys


def fixture_route():
    points=[{'lat':40.4,'lng':49.8+i*0.005} for i in range(5)]
    stops=[{**p,'sequence':i+1,'name':f'Stop {i+1}','source_id':i+1} for i,p in enumerate(points)]
    direction={'id':1,'label':'Outbound','shape':points,'stops':stops}
    route={'source_id':1,'code':'1','carrier':'Test','tariff_label':'0.60 AZN'}
    return route,direction


def test_direct_trip_respects_direction_and_walking_limit():
    route,direction=fixture_route()
    start,end=direction['stops'][1],direction['stops'][3]
    result=match_direction(route,direction,start,end,0.1)
    assert result['board']['sequence']==2 and result['alight']['sequence']==4
    assert result['stop_count']==2 and result['ride_minutes']>0
    assert match_direction(route,direction,end,start,0.1) is None
    assert match_direction(route,direction,{'lat':41,'lng':50},end,0.8) is None


def test_projection_is_open_and_prediction_clamps_to_terminal():
    _,direction=fixture_route()
    path=direction['shape']
    assert locate(path[-1],path)[0]>1
    assert point_at(path,999)==path[-1]
    assert point_at(path,0)==path[0]


def test_malformed_provider_coordinates_do_not_discard_valid_stops():
    result=normalize_stops([{'id':1,'latitude':'40.4','longitude':'49.8'},
                            {'id':2,'latitude':'40,498,112','longitude':'50,206,297'}])
    assert len(result['stops'])==1 and result['excluded_invalid_stops']==1


def test_gps_freshness_passed_stop_off_route_and_average_speed(client):
    _,direction=fixture_route()
    now=utcnow()
    with client.app.state.sessions() as session:
        for vehicle,point,seconds,speed in [
            ('good',direction['shape'][0],20,10),('good',direction['shape'][0],0,30),
            ('stale',direction['shape'][0],31,18),('passed',direction['shape'][3],0,18),
            ('off',{'lat':41,'lng':50},0,18)]:
            session.add(VehicleGPS(vehicle_id=vehicle,route_source_id=1,direction_id=1,**point,speed_kmh=speed,ts=now-timedelta(seconds=seconds)))
        session.commit()
    result=gps_estimates(client.app.state.sessions,1,1,direction,2,4,'official',now)
    assert len(result['vehicles'])==1
    vehicle=result['vehicles'][0]
    assert vehicle['vehicle_id']=='good' and vehicle['speed_kmh']==20
    assert vehicle['eta_minutes']>0 and vehicle['destination_minutes']>vehicle['eta_minutes']
    assert [p['minutes'] for p in vehicle['predictions']]==[5,10,15]
    assert vehicle['predictions'][-1]['lng']==direction['shape'][-1]['lng']
    assert gps_estimates(client.app.state.sessions,1,1,direction,4,2,'official',now) is None


def test_journey_search_validation_and_demo_integration(client):
    stops=client.get('/routes/1/stops').json()
    response=client.post('/journeys/search',json={'origin':stops[3],'destination':stops[8],'mode':'demo','walking_limit_m':100})
    assert response.status_code==200
    journeys=response.json()['journeys']
    assert journeys and journeys[0]['code']=='DEMO-A'
    assert journeys[0]['board']['sequence']<journeys[0]['alight']['sequence']
    same={'lat':40.4,'lng':49.8}
    assert client.post('/journeys/search',json={'origin':same,'destination':same}).status_code==422
    assert client.post('/journeys/search',json={'origin':{'lat':999,'lng':49},'destination':same}).status_code==422
    assert client.post('/journeys/search',json={'origin':stops[3],'destination':stops[8],'walking_limit_m':5000}).status_code==422


def test_external_gps_ingestion_and_arrivals_are_isolated_from_demo(client):
    route=client.get('/official/routes/1').json()
    point=route['directions'][0]['shape'][0]
    payload={**point,'route_source_id':1,'direction_id':1,'vehicle_id':'TEST-BUS','speed_kmh':18}
    assert client.post('/vehicles/gps',json=payload).status_code==201
    response=client.get('/journeys/vehicles',params={'route_id':1,'direction_id':1,'board':3,'alight':8})
    assert response.status_code==200
    assert [v['vehicle_id'] for v in response.json()['vehicles']]==['TEST-BUS']
    with client.app.state.sessions() as session:
        assert session.query(BusPosition).count()==0
    assert client.post('/vehicles/gps',json={**payload,'speed_kmh':-1}).status_code==422
    assert client.post('/vehicles/gps',json={**payload,'direction_id':999}).status_code==422
    assert client.get('/journeys/vehicles',params={'route_id':1,'direction_id':1,'board':8,'alight':3}).status_code==422


def test_walk_bus_walk_off_stop_endpoints_and_traveled_segment():
    route,direction=fixture_route()
    origin={**direction['stops'][1],'lat':40.401}
    destination={**direction['stops'][3],'lat':40.402}
    result=match_direction(route,direction,origin,destination,0.3)
    assert result is not None
    assert [leg['type'] for leg in result['legs']]==['walk','bus','walk']
    assert result['walk_to_m']>100 and result['walk_from_m']>200
    assert result['walk_to_minutes']>1 and result['walk_from_minutes']>2
    assert result['shape'][0]['lng']==direction['stops'][1]['lng']
    assert result['shape'][-1]['lng']==direction['stops'][3]['lng']
    assert result['planned_minutes']>=sum(leg['minutes'] for leg in result['legs'])-0.1
    assert match_direction(route,direction,origin,destination,0.05) is None


def test_farther_boarding_stop_and_incomplete_membership_do_not_hide_bus():
    route,direction=fixture_route()
    route={**route,'directions':[direction]}
    origin={**direction['stops'][1],'lat':40.401}
    destination={**direction['stops'][3],'lat':40.401}
    # Eight closer stops serve no bus. The ninth stop supplies the usable line.
    stops=[{'id':i,'lat':origin['lat']+0.00001*i,'lng':origin['lng']} for i in range(1,9)]
    stops.append({'id':9,**{k:direction['stops'][1][k] for k in ('lat','lng')}})
    stops.append({'id':10,**{k:destination[k] for k in ('lat','lng')}})
    class Source:
        async def fetch(self,key,path,normalize):
            if key=='journey:stops':
                return {'stops':stops,'stale':False}
            return {'ids':[1] if key=='stop-buses:9' else [],'stale':False}
        async def route(self,source_id):
            return route
    data=asyncio.run(search_journeys(Source(),None,origin,destination,'official',0.3))
    assert data['journeys'] and data['strategy']=='walk_bus_walk'
    assert data['journeys'][0]['walk_to_m']>0


def test_bad_stop_source_keeps_usable_results_but_marks_partial():
    route,direction=fixture_route()
    route={**route,'directions':[direction]}
    origin,destination=direction['stops'][1],direction['stops'][3]
    class Source:
        async def fetch(self,key,path,normalize):
            if key=='journey:stops':
                return {'stops':[{'id':1,**origin},{'id':2,**destination}],'stale':False}
            if key=='stop-buses:1':
                raise HTTPException(503,'unavailable')
            return {'ids':[1],'stale':False}
        async def route(self,source_id):
            return route
    data=asyncio.run(search_journeys(Source(),None,origin,destination,'official',0.1))
    assert data['partial'] and data['journeys']
