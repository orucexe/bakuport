# Real transit data: verified sources and boundaries

Checked on 2026-10-31. The public endpoints below were tested with anonymous, read-only requests. No account credentials, extracted mobile-app tokens, or private operator systems were used.

## Integrated: official AYNA route information

- Passenger-facing map: https://map.ayna.gov.az/
- Its public route catalog: `https://map-api.ayna.gov.az/api/bus/getBusList`
- Its public route detail: `https://map-api.ayna.gov.az/api/bus/getBusById?id=1`
- Official agency description: https://www.ayna.gov.az/az/news/avtobuslarla-bagli-melumatlar-map-aynada-739

The catalog returned **209 routes**. This is the AYNA catalog, not a claim that all 209 routes are operated by BakuBus. Route details identify the actual carrier. The app retrieves real route numbers, endpoints, carrier, fare, published length, directional road polylines and associated stop lists. AYNA's route and stop identifiers occupy a separate namespace from the existing demo and OpenData records; they are not guessed or joined by similar names.

Verified examples: route 1 has 21 forward and 24 return stop entries. Route 62 was fetched through the new app adapter from the upstream service and returned two directions and 63 stop entries, with `tariffStr=0.60 AZN`. These are source observations, not promises that fares or geometry will remain unchanged.

The app exposes `/official/routes` and `/official/routes/{source_id}` and the UI at `/#routes`. Stop order follows the provider's directional list, and road geometry uses its `flowCoordinates`. The service's `tariff` values are in qepik; `tariff_azn` divides by 100 and the UI prefers the source's own `tariffStr` label. No official-route vehicle, occupancy, delay or ETA is manufactured from this static information.

## Resilience and freshness

Successful normalized responses persist in `official_route_cache`. Default cache lifetime is 24 hours (`AYNA_CACHE_HOURS`), and the adapter makes at most one upstream request per second within the single backend process. Concurrent misses are coalesced. A failed key has a one-minute retry cooldown. Provider timeout is eight seconds.

The repository bundles the verified 209-entry catalog and route details for 1, 2 and 3 in `backend/data/ayna_snapshot.json`. This permits an initial offline view. Other route details are fetched on demand; not all 209 route geometries are bundled. Fresh cache responses include fetch timestamps. After an upstream failure, saved data is explicitly marked `stale=true`; if no saved detail exists, the endpoint returns 503 and the UI offers retry. Invalid provider data does not replace a valid cached response. Unknown route IDs are rejected from the catalog before an upstream request.

`fetched_at` means when the app obtained the source response, not the last time an agency edited the route. The public map API is a website dependency rather than a documented third-party integration contract; its availability and shape can change. Source links remain visible in the UI. No open-data license is inferred for AYNA responses.

## GPS investigation: not activated

The official AYNA map's inspected public requests provided route, stop and related reference data; they did not provide individual vehicle coordinates, timestamps or speed observations.

A historical public BakuBus example documented `https://www.bakubus.az/az/ajax/apiNew1` as a vehicle-position feed. A direct request on the check date returned **HTTP 404**, so it is not used as a functioning live source. Source example: https://github.com/MehrajLatifli/Follow-bus-with-BakuBus-API_MVVM

The current BakuBus website's public `/ajax/getRoutes?id=H1` returned static route/stop information, not a live vehicle feed. The public website's robots.txt advertises a 60-second crawl delay, so the app does not poll that website. An official BakuBus announcement mentions H1 tracking, but no working anonymous vehicle-position feed was verified from it. The old example and announcement are discovery leads, not evidence of current API availability.

Consequently, **real GPS is not integrated or presented as live**. The app's moving vehicles still belong to the clearly identified simulator and demo lines. The official-route view has no moving vehicle markers or invented ETA/density. An actual working GPS feed and its integration terms must be verified before enabling real vehicle tracking; no claim is made that such feeds do not exist.

## Other real data already integrated

The two OpenData CSV resources provide 3,600 stop coordinates and 15,686 daily route observations for 65 BakuBus route codes. They are documented in the README and `backend/data/manifest.json`. Daily payment validations stay separate from live occupancy and the synthetic density forecast. Those CSVs do not provide route-stop ordering; the new AYNA integration supplies its own official directional mapping separately.
