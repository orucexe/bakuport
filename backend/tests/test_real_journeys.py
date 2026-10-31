"""Offline regressions against captured official AYNA geometry, not invented lines."""
import json
from pathlib import Path
import math
import pytest

from app.services.journeys import match_direction, distance
from app.services.official_routes import normalize_route
from test_official_routes import raw_route

SNAPSHOT=json.loads((Path(__file__).parents[1]/'data'/'verified_journey_routes.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('route',SNAPSHOT['routes'],ids=lambda r:r['code'])
def test_real_official_walk_bus_walk(route):
    for direction in route['directions']:
        stops=direction['stops']
        origin={**stops[2],'lat':stops[2]['lat']+0.0005}
        destination={**stops[-3],'lat':stops[-3]['lat']+0.0005}
        trip=match_direction(route,direction,origin,destination,0.2)
        assert trip is not None
        assert trip['board']['sequence']<trip['alight']['sequence']
        assert trip['walk_to_m']<=200 and trip['walk_from_m']<=200
        assert [leg['type'] for leg in trip['legs']]==['walk','bus','walk']
        assert trip['ride_time_basis']=='published_route_duration_scaled'
        assert trip['tariff_label']==route['tariff_label']
        assert distance(trip['shape'][0],trip['board'])<0.2
        assert distance(trip['shape'][-1],trip['alight'])<0.2
        assert trip['planned_minutes']>0 and math.isfinite(trip['ride_minutes'])


def test_official_source_identifier_is_not_route_number(client):
    route=next(r for r in SNAPSHOT['routes'] if r['code']=='62')
    assert route['source_id']==48
    response=client.get('/official/routes/48').json()
    assert response['code']=='62' and response['published_duration_minutes']==52


def test_published_duration_is_optional_and_invalid_duration_not_used():
    raw=raw_route();raw['durationMinuts']=43
    assert normalize_route(raw,1)['published_duration_minutes']==43
    raw['durationMinuts']=float('nan')
    assert normalize_route(raw,1)['published_duration_minutes'] is None
    raw.pop('durationMinuts')
    assert normalize_route(raw,1)['published_duration_minutes'] is None
