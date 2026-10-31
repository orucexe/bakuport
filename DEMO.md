# Three-minute jury demo

## Before the presentation

1. Copy `.env.example` to `.env`; keep `DEMO_MODE=true`. No LLM key is needed.
2. Run `docker compose up --build`. Wait for the simulator to log GPS ticks.
3. Open passenger and operator pages in separate tabs: `http://localhost:5173/#passenger` and `http://localhost:5173/#operator`.
4. Select `DEMO-A`. Confirm the health endpoint reports a one-minute alert window. Leave surge off and start with no open alerts. If a previous demo alert exists, disable surge and allow roughly three minutes for recovery before presenting.
5. Check the map tiles, three routes, nine live buses and forecast. Have Swagger ready at `http://localhost:8000/docs`.

## 0:00–0:30 — Passenger view

- Introduce the project: real-time GPS plus passenger reports help people choose less crowded buses.
- Explicitly say that the routes, plates and history are fictional Baku-area demo data.
- Select a route and stop. Point to moving buses, the selected stop and sorted arrival times.

## 0:30–0:55 — Crowd report

- Choose a demo bus and tap `Dolu`.
- Show the acceptance message. Explain that bus-level labels use recent reports and route density updates on the minute cycle.
- Switch to the operator view and start `Sıxlıq ssenarisini başlat` for `DEMO-A` immediately.

## 0:55–1:55 — Operator analytics

- Show the network map, per-route density labels, confidence and current bus count.
- Explain the score: 60% recency-weighted crowd reports and 40% low speed / stop dwell.
- Show history and the next-hour statistical forecast. Identify synthetic seed history explicitly.
- Explain that production uses a continuous ten-minute rule, demonstrated here with a one-minute window. Scores are still calculated from actual simulator observations.

## 1:55–2:35 — Live alert and recommendation

- A fresh surge should generate one alert roughly 65–75 seconds after activation.
- Show the alert arriving without reloading, its timestamp and Azerbaijani recommendation.
- Point out that the template works without a key; a configured Anthropic call can improve the saved recommendation in the background.
- Explain duplicate prevention and the two-minute low-density recovery rule.
- Stop surge. Recovery continues after this short presentation; it is not immediate.

## 2:35–3:00 — Engineering evidence

- Open Swagger and show GPS ingestion, arrivals and operator endpoints.
- Mention passing `pytest` coverage for ETA, density, ten-minute boundaries, duplicate prevention, recovery and provider failures.
- Close with the complete loop: simulator → API → live map → crowdsourcing → density → operator action.

## Recovery commands

```sh
curl -X POST "http://localhost:8000/demo/surge?route_id=1&level=5"
curl "http://localhost:8000/operator/alerts?status=open"
curl -X POST "http://localhost:8000/demo/surge?route_id=1&level=0"
```

On PowerShell use `curl.exe`. If no alert appears, check `/health` for demo mode, simulator logs for successful observations, and `/operator/density` for a score at least 70. Stale GPS is excluded. A delayed or failed external LLM call must not delay the saved template recommendation.
