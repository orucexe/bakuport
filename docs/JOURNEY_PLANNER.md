# Journey planner and live location

The passenger entry point is `/#passenger`. It now starts with origin/destination search, not a route gallery. Suggestions are custom styled comboboxes with Arrow Up/Down, Enter, Escape, labels and visible focus. Suggestions use bundled OpenData stop names/coordinates; official route membership comes only from AYNA.

## Direct bus search

`POST /journeys/search` accepts `origin`/`destination` `{lat, lng}`, `mode` (`official` default or `demo`) and optional `walking_limit_m` (default 800, range 100–1500). Coordinates are validated and endpoints must be at least 30 m apart.

Official discovery uses the public map's `/api/stop/getAll` and `/api/bus/getBusesByStopId?stopId=...`. It checks up to 24 nearby stops at each endpoint and up to 32 candidate lines, prioritizing lines found at both ends. The union also considers lines missing from one endpoint's membership response; actual directional stop geometry validates both walking distances and boarding-before-alighting order. All valid pairs compete by combined walking and bus time, rather than requiring a bus at the exact origin/destination. A failed individual source lookup marks the response partial while retaining usable candidates. Cold searches can take longer because source requests remain paced at one per second.

Each result contains three `legs`: origin-to-boarding walk, bus ride, and alighting-to-destination walk. `walk_to_minutes` and `walk_from_minutes` can be zero for coincident locations. `shape` contains only the traveled boarding-to-alighting polyline, while `stops` retains the line's ordered stops. The UI lets the passenger choose a per-end walking limit of 400/800/1200/1500 m (1200 m initially). It displays each leg and the combined plan duration excluding waiting. Results are ranked by total time, then total walking distance; returned coverage is capped at twelve with a partial disclosure.

No transfers or address geocoding are inferred. Walking distance uses haversine rather than a verified pedestrian path. Planning speed is 18 km/h and walking speed is 4.5 km/h; waiting is excluded. A `partial` flag discloses bounded coverage, and `stale` identifies cached provider fallback. Existing persistent cache, request pacing and retry cooldown also cover stop discovery. AYNA currently includes several malformed comma-separated coordinates; these records are excluded rather than guessed. The normalizer records the excluded count.

## Device live location

The user's explicit location button starts `navigator.geolocation.watchPosition`. Browser permission and HTTPS/localhost are required. The latest location becomes the origin and a distinct live map marker. The button can stop watching; manual origin changes, mode changes and unmount also stop it. Denial, unsupported geolocation and timeouts have visible feedback. Coordinates used in a search are processed in memory and are not persisted as user location records. Results describe the last submitted search; moving the device does not automatically submit a new search.

## Bus GPS and predictions

`POST /vehicles/gps` accepts `vehicle_id`, official `route_source_id`, `direction_id`, `lat`, `lng` and `speed_kmh` (0–130). It validates official route/direction, timestamps receipt, persists a `vehicle_gps` row and broadcasts `vehicle_gps`. It is a provider adapter input, not a verified AYNA feed. No provider is configured automatically. As with the existing local ingestion endpoints, this prototype has no authentication; connect only trusted measurements in this local deployment.

`GET /journeys/vehicles?route_id=1&direction_id=1&board=3&alight=8&mode=official` returns candidate vehicles, fresh GPS timestamps, boarding ETA, destination ETA and predicted positions after 5/10/15 minutes. The selected direction's polyline is open: no invented end-to-start segment. Fixes older than 30 seconds, vehicles over 300 m from the path, and vehicles that have passed boarding are excluded. Speed averages the last five minutes with a 5 km/h floor and 18 km/h default. ETA/predictions account for fix age and clamp forecasts to the terminal. They assume continued average speed, not traffic-aware certainty or a timetable.

The UI polls every five seconds, independently hides stale fixes, offers vehicle selection and displays the selected vehicle's future position. In `demo` mode, this calculation reads the existing simulator's positions on explicitly fictional demo paths; it never relabels them as real route vehicles. Demo crowd reporting still uses `/crowd-reports`.

## Verification

### Verified real data and walking refinement

`backend/data/verified_journey_routes.json` contains freshly retrieved, normalized AYNA routes 1, 2 and 62 with a retrieval timestamp, real fares, directions, shapes and source-published total durations (43, 73 and 52 minutes respectively at capture). Route code **62** is AYNA source ID **48**; source IDs are never treated as public bus numbers. Startup imports these samples only when newer than the cached row. Network refresh can subsequently replace them.

Bus segment planning now scales the source-published total duration by the traveled directional road length when available. The `ride_time_basis` field distinguishes this approximation from `assumed_18_kmh`; neither is presented as a timetable or traffic-aware GPS ETA.

For up to three returned options, the browser calls the Google Maps Routes library with `WALKING` and requests path, distance, duration and warnings. Successful responses replace both walking legs and recalculate the combined duration; an option exceeding the selected walking limit is excluded. Other options and denied/unavailable services remain explicitly labeled straight-line estimates. Warnings are rendered as text. Routes API access/billing is required in addition to the existing map. This refinement is bounded to avoid issuing walking requests for every candidate. See [Google's official Routes guide](https://developers.google.com/maps/documentation/javascript/routes/get-a-route).

Manually curated landmark coordinates are labeled approximate, while OpenData and Google suggestions have source labels. Missing fares display as unknown instead of inventing a default price. Source retrieval dates appear with journey results.

Verification on this host: 62 backend tests, four frontend walking tests (`cd frontend && npm test`), production build and real Google walking request passed. The real walking example returned 305 m / 32 m, replacing straight-line estimates. A real off-stop search on line 62 returned lines 62 and 40 with source fares and published-duration timing. Cold searches took 61–72 seconds because the AYNA adapter retains its one-request-per-second pacing; cached repeats are faster. Official live bus GPS remains unavailable and demo telemetry remains explicitly separate.

Run `pytest` from the repo root and `npm run build` in `frontend`. Journey tests cover directional matching, walking bounds, invalid coordinates/provider records, open-path projection, terminal clamping, fresh/stale/off-route/passed GPS, smoothed speed, input validation and API ingestion-to-arrival isolation from the demo. Browser checks cover real AYNA search, combobox keyboard use, user-location permission/denial, GPS motion/prediction, reports, retry/empty states and responsive layouts.
