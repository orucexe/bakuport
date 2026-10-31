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
- 34 pytest tests passed; frontend TypeScript + production build passed.
- Real Edge: desktop and 390px passenger/operator layouts, no horizontal overflow.
- Browser: moving GPS markers, reports, route/stop selection, live alert + template.
- Browser: WebSocket reconnect, API error/recovery, persistent map tile failure state.
- Live simulator rehearsal: alert created after 65.7s; resolved after 126.1s recovery.
- Fresh SQLite startup, idempotent seeding, Compose YAML and PostgreSQL DDL checked.
- [ ] External environment check: Docker/PostgreSQL container startup (Docker absent).
- Real LLM calls were not made; success/failure/timeout paths use HTTP mocks.
- Fixed demo report timing, tile error clearing, timezone data and chart refresh churn.

## Open-data update
- [x] Download and inspect both user-provided OpenData CSV resources.
- [x] Import 3,600 real stops and 15,686 daily ride counts for 65 route codes.
- [x] Preserve provenance; do not invent official route-stop mappings or live loads.
- [x] Show real stop catalog/search and daily ridership chart/table with source labels.
- [x] Verify additive upgrade, preserved reports and repeat imports; restart app.
- [x] Update documentation; 39 tests, build, browser and static PostgreSQL DDL pass.
- Existing local database backed up under .local/backups before the real-data import.
- Source window: Jan 1-Sep 30, 2026; no October records invented or daily loads inferred.
- Backend, frontend and simulator remain running for the user after this update.
