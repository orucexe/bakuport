# IDDA implementation plan

## Assumptions and risks
- Budget: 120 minutes; one implementation stream; final 30 minutes are fixes only.
- Keep the stack in AGENTS.md; single backend worker and idempotent SQLAlchemy init.
- UI in Azerbaijani; code and documentation in English.
- Three explicitly fictional Baku demo routes, ten stops and three buses each.
- No authentication or production deployment in this local hackathon demo.
- Docker is unavailable on this host: verify locally where possible and report limits.
- Internet map tiles and optional Anthropic API may fail; show errors and use AI fallback.
- Omit optional anomaly detection and English UI toggle.

## 1. Foundation (0-20 min)
- [x] Compose, database schema, seed, env example.
- [x] GPS ingestion, live websocket, simulator and basic moving map.
- [x] Verify the thin slice and commit (local API/WS smoke and frontend build).

## 2. Backend (20-45 min)
- [x] Complete REST endpoints, typed Swagger responses and validated ingestion.
- [x] Route projection ETA with recent smoothed speed.
- [x] Minute density, confidence, persistent alert state and hysteresis.
- [x] Surge controls, websocket events; 22 backend tests passed; commit.

## 3. Frontend (45-70 min)
- [x] Passenger selectors, arrivals and crowd buttons.
- [x] Operator colored routes, alerts and history chart.
- [x] Reconnection, loading/error/empty states; build and real Edge desktop/mobile smoke passed.

## 4. AI (70-80 min)
- [x] Nonblocking recommendation with deterministic fallback.
- [x] Seeded seasonal forecast and chart; 30 tests and browser smoke passed.

## 5. Quality (80-120 min)
- [x] Unit tests: ETA, density, alert timing/reset/duplicates/recovery, validation.
- [x] GPS-to-arrivals integration and AI failure/nonblocking tests.
- [x] README, architecture, env guide, typed Swagger and three-minute DEMO.md.
- [x] Final build, tests, live surge rehearsal and fresh local database startup.
- [x] Update checklist, record verification limits and commit everything.

## Verification record
- Initial gate: 34 tests, build, desktop/mobile, GPS/report/alert/reconnect/error flows passed.
- Live simulator rehearsal: alert created after 65.7s; resolved after 126.1s recovery.
- Fresh SQLite startup, idempotent seeding, Compose YAML and PostgreSQL DDL checked.
- [ ] External environment check: Docker/PostgreSQL container startup (Docker absent).
- Real LLM calls were not made; success/failure/timeout paths use HTTP mocks.

## Open-data update
- [x] Download and inspect both user-provided OpenData CSV resources.
- [x] Import 3,600 real stops and 15,686 daily ride counts for 65 route codes.
- [x] Preserve provenance; do not invent official route-stop mappings or live loads.
- [x] Show real stop catalog/search and daily ridership chart/table with source labels.
- [x] Verify additive upgrade, preserved reports and repeat imports; restart app.
- [x] Update documentation; 39 tests, build, browser and static PostgreSQL DDL pass.
- Source window: Jan 1-Sep 30, 2026; no October records invented or daily loads inferred.

## Official route integration
- [x] Inspect official AYNA/BakuBus services; verify 209 route entries and geometry.
- [x] Integrate actual bidirectional route paths, stops, carrier and tariff in the UI.
- [x] Add persistent source cache, bounded requests and explicit stale/error states.
- [x] Keep official metadata separate from simulated GPS; document unavailable feed.
- [x] 48 tests, build, desktop/mobile/error browser checks and real route 62 fetch pass.
- Old BakuBus GPS endpoint returned 404; no unverified GPS feed was enabled.

## Google Maps (user-requested stack change)
- [x] Google Maps on all views; ignored key/env/build wiring, docs, browser checks and commit complete.

## Passenger UI (requested follow-up; approximately 45 min)
- [x] Apply ui-ux-pro-max with DESIGN-airbnb.md as the visual source of truth.
- [x] Scope white/rose styling, desktop search/rail and mobile native dialogs to passenger.
- [x] Preserve maps, demo labels, route/stop selection, arrivals, reports and source links.
- [x] Build, Edge 320-1440px layouts, dialogs, reports, API error/empty/retry and existing views pass; commit.

## Official passenger routes (approximately 30 min)
- [x] AYNA passenger catalog, shapes/directions/stops, separate demo; build/browser verified and committed.

## Journey planner (approximately 60 min)
- [x] Replace passenger route gallery with designed origin/destination comboboxes and bus results.
- [x] Direct-route search via nearby AYNA stops; explicit walking bounds, no invented transfers.
- [x] Opt-in device live location; GPS ingestion, freshness-aware ETA and future bus positions.
- [x] 54 tests, build, real search, demo GPS/predictions, permissions/errors/320-1440px verified; documented and committed.
