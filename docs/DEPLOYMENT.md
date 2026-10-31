# Vercel frontend and Render backend

## Frontend

Vercel project: `idda-transit`, root directory `frontend`, build `npm run build`, output `dist`. `frontend/vercel.json` provides the SPA fallback (including `/admin`) and immutable asset caching. Google Maps browser configuration is set in Vercel production environment variables, not committed source.

Production frontend: https://bakuport.orucs.net (also https://idda-transit.vercel.app).
Production backend: https://idda-api.onrender.com.

Production sets `VITE_BACKEND_URL=https://idda-api.onrender.com` and `VITE_API_BASE_URL=/api`. Vercel rewrites `/api/:path*` to the Render backend, so REST stays on the frontend origin even on the custom domain. WebSocket connects directly to `wss://idda-api.onrender.com/ws/live`. If either endpoint changes, update the Vercel environment and rewrite destination before redeploying. Without `VITE_API_BASE_URL`, REST connects directly to `VITE_BACKEND_URL` and that origin must allow the frontend through CORS. With no backend configured, production shows an unavailable message and does not open an invalid Vercel WebSocket. Local Vite/Nginx retain their same-origin proxy.

## Render

1. Push the project to a GitHub/GitLab repository you control. A private repository is supported when connected to Render.
2. Connect that repository in Render and create a Blueprint from root `render.yaml`.
3. Review the free web-service/PostgreSQL resources and deploy. The backend uses `backend` as root, installs requirements, starts Uvicorn on `$PORT`, and checks `/health`.
4. Set `CORS_ORIGINS` to the exact Vercel production URL, comma separated if several origins are required. The blueprint initially allows `https://idda-transit.vercel.app` and local development. Add the final alias if Vercel assigns a different name.
5. Render's injected PostgreSQL URL is normalized to the installed psycopg driver. The database stores reports/cache/history; SQLite is not used for the hosted service.
6. Confirm `https://YOUR-SERVICE.onrender.com/health` and `/docs`, then configure the frontend variable above.

No simulator worker or external LLM key is deployed by this blueprint. Official metadata remains separate from simulated GPS; live vehicle measurements still require a provider. Do not upload `.env`, `.venv`, `node_modules`, `.local` or Vercel CLI credentials to the repository. The existing client-side operator login is a prototype UI gate, not backend authorization.

## Verification

Connected deployment verified: Render health/docs/official catalog, CORS for the Vercel alias, custom-domain REST proxy, 3,600 stops, 209 routes, Google map and direct WebSocket handshake. A real hosted walk/bus/walk search returned five options (1, 11, E1, 49, 32); the cold upstream search took 81.6 seconds and a cached request through the production frontend took 3.4 seconds. No live vehicle provider was added by deploying the backend.

Run `pytest`, `cd frontend && npm test` and `npm run build`. After hosting, check the production passenger page and direct `/admin` navigation, map loading, `/health`, CORS preflight, journey search and the direct Render WebSocket. A production frontend without the backend URL is a deployed UI with API functionality pending.
