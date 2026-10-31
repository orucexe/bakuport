# Journey planner and live location

The passenger entry point is `/#passenger`. It now starts with origin/destination search, not a route gallery. Suggestions are custom styled comboboxes with Arrow Up/Down, Enter, Escape, labels and visible focus. Suggestions use bundled OpenData stop names/coordinates; official route membership comes only from AYNA.

## Direct bus search

`POST /journeys/search` accepts `origin`/`destination` `{lat, lng}`, `mode` (`official` default or `demo`) and optional `walking_limit_m` (default 800, range 100–1500). Coordinates are validated and endpoints must be at least 30 m apart.

Official discovery uses the public map's `/api/stop/getAll` and `/api/bus/getBusesByStopId?stopId=...`. It checks up to four nearest stops at each endpoint, intersects serving line IDs, loads up to twelve common lines, then verifies boarding precedes alighting within the same direction. Stop-to-shape projection determines traveled road distance. Results are ordered by estimated ride/walk duration and include full directional geometry, boarding/alighting stops, carrier, fare and provenance.

No transfers or address geocoding are inferred. Walking distance uses haversine rather than a verified pedestrian path. Planning speed is 18 km/h and walking speed is 4.5 km/h; waiting is excluded. A `partial` flag discloses bounded coverage, and `stale` identifies cached provider fallback. Existing persistent cache, request pacing and retry cooldown also cover stop discovery. AYNA currently includes several malformed comma-separated coordinates; these records are excluded rather than guessed. The normalizer records the excluded count.

## Device live location

The user's explicit location button starts `navigator.geolocation.watchPosition`. Browser permission and HTTPS/localhost are required. The latest location becomes the origin and a distinct live map marker. The button can stop watching; manual origin changes, mode changes and unmount also stop it. Denial, unsupported geolocation and timeouts have visible feedback. Coordinates used in a search are processed in memory and are not persisted as user location records. Results describe the last submitted search; moving the device does not automatically submit a new search.

## Bus GPS and predictions

`POST /vehicles/gps` accepts `vehicle_id`, official `route_source_id`, `direction_id`, `lat`, `lng` and `speed_kmh` (0–130). It validates official route/direction, timestamps receipt, persists a `vehicle_gps` row and broadcasts `vehicle_gps`. It is a provider adapter input, not a verified AYNA feed. No provider is configured automatically. As with the existing local ingestion endpoints, this prototype has no authentication; connect only trusted measurements in this local deployment.

`GET /journeys/vehicles?route_id=1&direction_id=1&board=3&alight=8&mode=official` returns candidate vehicles, fresh GPS timestamps, boarding ETA, destination ETA and predicted positions after 5/10/15 minutes. The selected direction's polyline is open: no invented end-to-start segment. Fixes older than 30 seconds, vehicles over 300 m from the path, and vehicles that have passed boarding are excluded. Speed averages the last five minutes with a 5 km/h floor and 18 km/h default. ETA/predictions account for fix age and clamp forecasts to the terminal. They assume continued average speed, not traffic-aware certainty or a timetable.

The UI polls every five seconds, independently hides stale fixes, offers vehicle selection and displays the selected vehicle's future position. In `demo` mode, this calculation reads the existing simulator's positions on explicitly fictional demo paths; it never relabels them as real route vehicles. Demo crowd reporting still uses `/crowd-reports`.

## Verification

Run `pytest` from the repo root and `npm run build` in `frontend`. Journey tests cover directional matching, walking bounds, invalid coordinates/provider records, open-path projection, terminal clamping, fresh/stale/off-route/passed GPS, smoothed speed, input validation and API ingestion-to-arrival isolation from the demo. Browser checks cover real AYNA search, combobox keyboard use, user-location permission/denial, GPS motion/prediction, reports, retry/empty states and responsive layouts.
