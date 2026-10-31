# AGENTS.md

## 0. How to work (read first)

- This is a **hackathon project (IDDA)**. Time is limited. Goal: a **working, demo-able system**, not a perfect one.
- Total time available: `[FILL IN: e.g. 6 hours]`. Team size: `[FILL IN]`.
- **Reply to me in Azerbaijani.** Code, identifiers, comments, commit messages and docs: English (README may include short Azerbaijani notes).
- **Step 1:** Read this whole file. Then create `PLAN.md` yourself: milestones, task checklist per milestone, rough time budget (use the proportions in section 9), and risks. Keep it under ~80 lines.
- **Step 2:** Start executing immediately after writing `PLAN.md`. Do not wait for approval unless you hit a real blocker or want to deviate from this file.
- After each milestone: run the app/tests, `git commit` with a clear message, tick the checklist in `PLAN.md`, and give me a 3-5 line summary in Azerbaijani.
- Build a **thin end-to-end slice first** (simulator -> API -> moving bus on a map), then add density, alerts, AI, polish. Never build everything in parallel half-finished.
- If something is ambiguous, make a sensible assumption, note it in `PLAN.md` under "Assumptions", and continue. Ask me only if the choice is expensive to reverse.
- No unnecessary refactors, no heavy dependencies, no secrets in code.

## 1. Project: Smart Transit & Crowdsourcing Engine

A real-time route and passenger-load analytics system for **Baku public transport**.
It combines **GPS coordinates** and **passenger crowdsourcing reports** to show live bus positions, ETA, and crowd density.

Two audiences, two modules:

### Module A: Passenger module
- User picks a **route or a stop**.
- Sees **live bus positions on a map** (real-time updates).
- Sees **estimated time of arrival (ETA)** of upcoming buses at the selected stop.
- Sees the current **crowd level** of each bus/route (green / yellow / red).
- Can submit a one-tap **crowd report** ("empty / medium / full").

### Module B: Operator module (government / transit authority)
- **Analytics engine** ingests GPS data + crowdsourcing reports and keeps a **density map per route** up to date.
- If density on a route stays **high for 10 minutes**, the operator gets an **alert** (live in the UI, stored in DB).
- Operator dashboard: heatmap/colored routes, active alerts list, density-over-time chart per route.

## 2. Required deliverables (from the task)

1. Backend and API (**REST** or GraphQL; we use REST + WebSocket)
2. Database (**PostgreSQL** or MongoDB; we use PostgreSQL)
3. UI/UX
4. AI integration
5. Testing
6. Documentation

## 3. Tech stack (decided, do not change without a strong reason)

| Part | Choice |
|---|---|
| Backend | Python 3.11+, **FastAPI**, SQLAlchemy 2.x, Alembic (or simple SQL init), Pydantic v2 |
| Realtime | **WebSocket** `/ws/live` (SSE acceptable fallback) |
| DB | **PostgreSQL 16** (plain, no PostGIS; use haversine in Python) |
| Frontend | **React + Vite + TypeScript**, **Leaflet** (react-leaflet) for maps, Recharts for charts |
| Simulator | Python script/service that simulates buses and crowd reports |
| Infra | **Docker Compose** (services: `db`, `backend`, `frontend`, `simulator`) |
| Tests | `pytest` (backend), basic smoke test for frontend build |

Target: `docker compose up --build` starts everything. Provide `.env.example`.

## 4. Suggested repo layout

```
/backend
  /app
    main.py
    models.py, schemas.py, db.py
    /routers   (routes, stops, buses, gps, crowd, operator, ws)
    /services  (eta.py, density.py, alerts.py, ai.py)
  /tests
/frontend
  /src (pages: Passenger, Operator; components: Map, StopPicker, AlertList, DensityChart)
/simulator
  simulate.py
docker-compose.yml
.env.example
README.md
PLAN.md
AGENTS.md
```

## 5. Data model (PostgreSQL)

- `routes` (id, code, name, color)
- `stops` (id, name, lat, lng)
- `route_stops` (route_id, stop_id, sequence)  -> defines ordered path of each route
- `buses` (id, route_id, plate, capacity)
- `bus_positions` (id, bus_id, lat, lng, speed_kmh, ts)  -> index on (bus_id, ts)
- `crowd_reports` (id, bus_id nullable, route_id, level 1-5, ts)
- `density_snapshots` (id, route_id, score 0-100, ts)  -> written every minute
- `alerts` (id, route_id, type, status open/resolved, started_at, resolved_at, message, ai_recommendation)

Seed data: **3 illustrative Baku routes** with ~8-12 stops each using realistic Baku-area coordinates. Label them clearly as demo data (do not claim they are real route numbers).

## 6. API (REST + WebSocket)

- `GET /health`
- `GET /routes`, `GET /routes/{id}`, `GET /routes/{id}/stops`
- `GET /stops`, `GET /stops/{id}/arrivals` -> upcoming buses with ETA (minutes) and crowd level
- `GET /routes/{id}/buses` -> live positions
- `POST /gps` -> ingest bus position
- `POST /crowd-reports` -> passenger crowd report
- `GET /operator/density` -> current density per route
- `GET /operator/density/{route_id}/history?minutes=60`
- `GET /operator/alerts?status=open`
- `GET /operator/forecast/{route_id}` -> AI/ML forecast (see section 8)
- `POST /demo/surge?route_id=..&level=..` -> demo helper to force high density
- `WS /ws/live` -> pushes bus positions, density updates, new/resolved alerts

Swagger/OpenAPI docs must be available at `/docs`. Add short descriptions and examples to endpoints.

## 7. Core engine logic

### ETA
- For each bus: compute remaining distance along the route's ordered stops to the target stop (sum of haversine segments).
- Speed = smoothed average of the bus's recent speeds (last ~5 min), with a floor (e.g. 5 km/h) and a default (e.g. 18 km/h) when no data.
- ETA minutes = distance / speed. Only show buses that have not yet passed the stop. Return sorted ascending.

### Density score (0-100) per route, recalculated every minute
- **Crowd component:** recency-weighted average of `crowd_reports` in the last 5 min (exponential decay; level 1-5 mapped to 0-100).
- **GPS component:** low average speed relative to expected, and long dwell at stops, increase the score.
- `score = 0.6 * crowd + 0.4 * gps` (make weights configurable). If there are no recent reports, rely on the GPS component and lower confidence.
- Store each result in `density_snapshots`; push over WebSocket.
- Color mapping: <40 green, 40-70 yellow, >=70 red (configurable).

### Alert rule
- If `score >= DENSITY_THRESHOLD` (default 70) **continuously for `ALERT_WINDOW_MINUTES` (default 10)** on a route -> create **one** open alert for that route (no duplicates).
- Resolve the alert when the score stays below `threshold - hysteresis` for a short period (e.g. 2 min).
- Env vars: `DENSITY_THRESHOLD`, `ALERT_WINDOW_MINUTES`. **Demo mode** sets the window to 1 minute so the jury can see alerts quickly.
- When an alert is created: save to DB, push via WebSocket, and generate the AI recommendation (section 8).

## 8. AI integration (keep small but visible)

1. **Operator recommendation:** on new alert, produce a short recommendation (e.g. "Route X has had high density for 10 min; add 2 buses / adjust headway"). Use the Anthropic or OpenAI API if `LLM_API_KEY` is set; otherwise fall back to a deterministic template. The app must work with no key.
2. **Density forecast:** simple time-series/regression baseline by hour-of-day and day-of-week from `density_snapshots` (seed some synthetic history so the forecast is not empty). Expose via `/operator/forecast/{route_id}` and show a small chart in the operator UI.
3. **Anomaly flag (optional, if time):** mark buses stationary for too long or with impossible GPS jumps.

Never hardcode API keys. Read from env. Handle LLM failures gracefully.

## 9. Milestones and time proportions

Adapt to the real time available; record the final plan in `PLAN.md`.

1. **(~15%) Foundation:** docker-compose, DB schema, seed data, simulator producing GPS + crowd reports.
2. **(~30%) Backend core:** API, ingestion, ETA, density engine, alert logic, WebSocket.
3. **(~30%) Frontend:** passenger page (map, stop/route picker, arrivals, report button), operator page (density colors, alerts, chart).
4. **(~10%) AI:** recommendation + forecast.
5. **(~15%) Quality:** tests, README, demo script, bug fixing. **Last 30 minutes: no new features, only fixes and demo rehearsal.**

## 10. Simulator requirements

- 3 routes, 3-6 buses each, moving along the ordered stops with realistic speed variation, looping at the end.
- Sends GPS via `POST /gps` every few seconds.
- Generates random crowd reports with a time-of-day bias.
- Supports a **surge mode** (CLI flag or `/demo/surge`) that makes one route consistently crowded and slow to trigger the alert flow on demand.

## 11. UI/UX guidelines

- Mobile-first for the passenger page (big tap targets, one-tap crowd report). Operator page is desktop-first.
- Clear color language: green/yellow/red for density. Don't rely on color alone (add labels/icons).
- Show loading and empty states. Map must update live without page refresh.
- Language: UI text in **Azerbaijani** (with an English toggle if time allows).

## 12. Testing (minimum bar)

- Unit tests for: ETA calculation, density score, **10-minute alert rule** (including no-duplicate and resolve behavior), crowd-report validation.
- One API integration test: `POST /gps` -> `GET /stops/{id}/arrivals`.
- Tests must run with a single command (`pytest`) and be mentioned in README.

## 13. Documentation

- `README.md`: what it is, architecture diagram (Mermaid is fine), how to run (`docker compose up --build`), env vars, demo walkthrough (how to trigger surge and see the alert), how to run tests.
- Swagger at `/docs`.
- A short "How the density score and alert rule work" section in README.
- Keep a `DEMO.md` with a 3-minute demo script.

## 14. Code and safety rules

- Small, readable functions; type hints in Python; TypeScript types in frontend.
- Validate all inputs (lat/lng ranges, crowd level 1-5). Basic error handling and logging.
- No secrets in the repo. Provide `.env.example`.
- Commit after every working milestone.

## 15. Definition of done

- [ ] `docker compose up --build` starts everything from scratch
- [ ] Passenger page shows live buses and ETA for a chosen stop/route
- [ ] Crowd report from the UI changes the density
- [ ] Operator page shows density per route and receives an alert in real time
- [ ] 10-minute rule works (and demo mode makes it demonstrable in ~1 minute)
- [ ] AI recommendation and forecast visible (with fallback if no API key)
- [ ] Tests pass
- [ ] README, DEMO.md and Swagger ready
- [ ] Everything committed