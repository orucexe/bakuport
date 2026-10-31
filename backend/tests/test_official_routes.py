import asyncio
from datetime import timedelta

import httpx
import pytest

from app.db import utcnow
from app.models import OfficialRouteCache
from app.services.official_routes import OfficialRoutes, normalize_catalog, normalize_route
from fastapi import HTTPException


def raw_route(route_id=1):
    return {"id": route_id, "number": str(route_id), "carrier": "BakuBus MMC",
            "firstPoint": "Start", "lastPoint": "End", "routLength": 25.8, "tariff": 60,
            "tariffStr": "0.60 AZN", "routes": [{"directionTypeId": 1, "flowCoordinates": [
                {"lat": 40.38, "lng": 49.85}, {"lat": 40.4, "lng": 49.9}]}],
            "stops": [{"directionTypeId": 1, "stop": {"id": 100, "code": "1000100",
                "name": "Start", "latitude": "40.38", "longitude": "49.85"}}]}


def service(client, handler):
    return OfficialRoutes(client.app.state.sessions, client.app.state.settings, httpx.MockTransport(handler))


def expire_route(client):
    with client.app.state.sessions() as session:
        row = session.get(OfficialRouteCache, "route:1")
        row.fetched_at = utcnow() - timedelta(days=2)
        session.commit()


def test_official_catalog_paths_metadata_and_isolation_from_demo(client):
    catalog = client.get('/official/routes').json()
    assert len(catalog['routes']) == 209
    assert not catalog['live_positions_available']
    detail = client.get('/official/routes/1').json()
    assert detail['code'] == '1' and detail['carrier'] == 'BakuBus MMC'
    assert detail['tariff_azn'] == 0.6
    assert [len(direction['stops']) for direction in detail['directions']] == [21, 24]
    assert all(len(direction['shape']) > 2 for direction in detail['directions'])
    assert len(client.get('/routes').json()) == 3
    assert client.get('/official/routes/999999').status_code == 404
    assert client.get('/official/routes/0').status_code == 422


def test_fresh_cache_does_not_contact_provider(client):
    def handler(request):
        pytest.fail('Fresh cache must not request the provider')

    adapter = service(client, handler)

    async def verify():
        try:
            assert (await adapter.route(1))['from_cache']
        finally:
            await adapter.client.aclose()
    asyncio.run(verify())


@pytest.mark.parametrize('kind', ['http_error', 'timeout', 'malformed', 'wrong_id'])
def test_stale_cache_fallback_and_retry_backoff(client, kind):
    expire_route(client)
    calls = []

    def handler(request):
        calls.append(request)
        if kind == 'timeout':
            raise httpx.ReadTimeout('Provider timeout')
        if kind == 'http_error':
            return httpx.Response(503)
        return httpx.Response(200, json={} if kind == 'malformed' else raw_route(999))

    adapter = service(client, handler)

    async def verify():
        try:
            first, second = await adapter.route(1), await adapter.route(1)
            assert first['stale'] and second['stale']
            assert first['code'] == '1' and first['carrier'] == 'BakuBus MMC'
            assert len(calls) == 1
        finally:
            await adapter.client.aclose()
    asyncio.run(verify())


def test_successful_refresh_is_persisted_and_coalesces_requests(client):
    expire_route(client)
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.path == '/api/bus/getBusById'
        assert request.url.params['id'] == '1'
        return httpx.Response(200, json=raw_route())

    adapter = service(client, handler)

    async def verify():
        try:
            results = await asyncio.gather(adapter.route(1), adapter.route(1))
            assert all(not result['stale'] for result in results)
            assert sum(not result['from_cache'] for result in results) == 1
            assert len(calls) == 1
        finally:
            await adapter.client.aclose()
    asyncio.run(verify())
    with client.app.state.sessions() as session:
        saved = session.get(OfficialRouteCache, 'route:1')
        assert saved.payload['first_stop'] == 'Start'


def test_unavailable_uncached_route_returns_error_without_fake_data(client):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503)

    adapter = service(client, handler)

    async def verify():
        try:
            for _ in range(2):
                with pytest.raises(HTTPException) as exc:
                    await adapter.route(4)
                assert exc.value.status_code == 503
            assert len(calls) == 1
        finally:
            await adapter.client.aclose()
    asyncio.run(verify())


def test_normalization_validates_identifiers_geometry_and_fares():
    with pytest.raises(ValueError):
        normalize_catalog([{'id': 1.5, 'number': '1'}])
    with pytest.raises(ValueError):
        normalize_catalog([{'id': 1, 'number': '1'}, {'id': 1, 'number': '2'}])
    with pytest.raises(ValueError):
        normalize_route(raw_route(2), 1)
    raw = raw_route()
    raw['routes'][0]['flowCoordinates'][0]['lat'] = float('nan')
    with pytest.raises(ValueError):
        normalize_route(raw, 1)
    raw = raw_route()
    raw['tariff'] = -60
    with pytest.raises(ValueError):
        normalize_route(raw, 1)
