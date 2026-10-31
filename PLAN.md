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
- [ ] Complete REST endpoints and validated ingestion.
- [ ] Route projection ETA with recent smoothed speed.
- [ ] Minute density, confidence, persistent alert state and hysteresis.
- [ ] Surge controls, websocket events; verify and commit.

## 3. Frontend (45-70 min)
- [ ] Passenger selectors, arrivals and crowd buttons.
- [ ] Operator colored routes, alerts and history chart.
- [ ] Reconnection, loading/error/empty states; build and commit.

## 4. AI (70-80 min)
- [ ] Nonblocking recommendation with deterministic fallback.
- [ ] Seeded seasonal forecast and chart; verify and commit.

## 5. Quality (80-120 min)
- [ ] Unit tests: ETA, density, alert timing/reset/duplicates/recovery, validation.
- [ ] GPS-to-arrivals integration and AI failure tests.
- [ ] README, architecture, env guide, Swagger and three-minute DEMO.md.
- [ ] Final build, tests, live surge rehearsal and clean-start checks where supported.
- [ ] Update checklist, record verification limits and commit everything.
