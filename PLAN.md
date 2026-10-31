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
- [x] Compose/schema/seed/env, GPS/WS/simulator/moving map verified and committed.

## 2. Backend (20-45 min)
- [x] REST/Swagger/validation, projected ETA, density/alerts/hysteresis, surge/WS; 22 tests and commit.

## 3. Frontend (45-70 min)

## 4. AI (70-80 min)
- [x] Nonblocking AI fallback, seasonal forecast/chart; 30 tests and browser smoke passed.

## 5. Quality (80-120 min)
- [x] ETA/density/alerts/validation/GPS/AI tests; README/architecture/env/Swagger/DEMO ready.
- [x] Final build, tests, live surge rehearsal and fresh local database startup.

## Verification record
- Initial gate: 34 tests, build, desktop/mobile, GPS/report/alert/reconnect/error flows passed.
- Live simulator rehearsal: alert created after 65.7s; resolved after 126.1s recovery.
- Fresh SQLite startup, idempotent seeding, Compose YAML and PostgreSQL DDL checked.
- [ ] External environment check: Docker/PostgreSQL container startup (Docker absent).
- Real LLM calls were not made; success/failure/timeout paths use HTTP mocks.

## Open-data update
- [x] Inspect/import OpenData: 3,600 stops, 15,686 daily rides/65 codes; preserve provenance.
- [x] Show real stop catalog/search and daily ridership chart/table with source labels.
- [x] Verify additive upgrade, preserved reports and repeat imports; restart app.
- [x] Update documentation; 39 tests, build, browser and static PostgreSQL DDL pass.

## Official route integration
- [x] AYNA 209 routes/directions/stops/fares, cache/errors and source isolation; 48 tests/build/browser pass.

## Google Maps (user-requested stack change)

## Passenger UI (requested follow-up; approximately 45 min)
- [x] Airbnb passenger UI, scoped styling/maps/reports/sources; build/Edge verified and committed.

## Official passenger routes (approximately 30 min)

## Journey planner (approximately 60 min)
- [x] Replace passenger route gallery with designed origin/destination comboboxes and bus results.
- [x] Direct-route search via nearby AYNA stops; explicit walking bounds, no invented transfers.
- [x] Opt-in device live location; GPS ingestion, freshness-aware ETA and future bus positions.
- [x] 54 tests, build, real search, demo GPS/predictions, permissions/errors/320-1440px verified; documented and committed.

## Operator Airtable UI (approximately 40 min)
- [x] DESIGN-airtable.md operator shell/cards/charts; map, route/surge and statistics preserved.
- [x] Edge desktop/mobile/navigation/surge/tables/source dialog and build verified; documented and committed.

## Passenger mobile-first follow-up
- [x] Mobile baseline, styled suggestions, 48px actions; tablet/desktop progressive layout.
- [x] Center passenger map in its own row; verify 375-1920px and update Vercel production.
- [x] Edge 320-1440px/landscape, keyboard/pickers/search/route finder and build pass.

## Walk-bus-walk correction (approximately 25 min)
- [x] Broaden nearby stop discovery and validate/rank complete walking/bus/walking legs.
- [x] Show walking limit, leg times and traveled bus segment; keep estimate boundaries explicit.
- [x] 57 tests, build, real AYNA off-stop search and mobile/desktop legs/limits verified; documented and committed.

## Real-data verification (approximately 40 min)
- [x] Verified AYNA 1/2/62 captures, published durations/source and real-geometry regression tests.
- [x] Unknown fare/source labels, Google walking paths/time/limits with explicit fallback.
- [x] 62 backend + 4 walking tests, build, real Google walking and AYNA searches pass; documented and committed.

## Vercel / Render deployment
- [x] Vercel project/environment, SPA routes, backend URL/WS wiring; frontend production published.
- [x] Render PostgreSQL blueprint/CORS/driver setup, deployment docs and two config tests.
- [x] Published github.com/orucexe/bakuport (master); clean checkout: 65 backend tests and frontend checks pass.
- [x] Connected Render/Vercel; REST/WS/maps/search verified. GitHub README rewritten with numbered setup, architecture/data; Docker API config corrected.
- [x] Remove requested README deployment section and four linked Markdown docs; deliver Azerbaijani AI declaration and technical explanation as validated DOCX.

## Unified Map Fallback (Google Maps & OpenStreetMap)
- [x] Universal map provider with seamless OpenStreetMap fallback on Google auth/load failure or timeout.
- [x] High-fidelity CartoDB Voyager transit tile styling with matching fonts, popups, and markers.
- [x] Portaled DOM markers and custom popups for buses, stops, and journey pins; toggle badge in legend.
- [x] 65 backend + 4 frontend tests and production build verified.
