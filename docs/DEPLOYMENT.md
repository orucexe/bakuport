# Vercel frontend and Render backend

## Frontend

Vercel project: `idda-transit`, root directory `frontend`, build `npm run build`, output `dist`. `frontend/vercel.json` provides the SPA fallback (including `/admin`) and immutable asset caching. Google Maps browser configuration is set in Vercel production environment variables, not committed source.

Set `VITE_BACKEND_URL=https://YOUR-SERVICE.onrender.com` after Render is ready, then redeploy. This is the backend root, without `/api`. REST requests go directly to that origin; WebSocket uses its `wss://.../ws/live`. With no backend configured, production shows a clear unavailable message and does not open an invalid Vercel WebSocket. Local Vite/Nginx continue using their existing same-origin proxy.

## Render

1. Push the project to a GitHub/GitLab repository you control. A private repository is supported when connected to Render.
2. Connect that repository in Render and create a Blueprint from root `render.yaml`.
3. Review the free web-service/PostgreSQL resources and deploy. The backend uses `backend` as root, installs requirements, starts Uvicorn on `$PORT`, and checks `/health`.
4. Set `CORS_ORIGINS` to the exact Vercel production URL, comma separated if several origins are required. The blueprint initially allows `https://idda-transit.vercel.app` and local development. Add the final alias if Vercel assigns a different name.
5. Render's injected PostgreSQL URL is normalized to the installed psycopg driver. The database stores reports/cache/history; SQLite is not used for the hosted service.
6. Confirm `https://YOUR-SERVICE.onrender.com/health` and `/docs`, then configure the frontend variable above.

No simulator worker or external LLM key is deployed by this blueprint. Official metadata remains separate from simulated GPS; live vehicle measurements still require a provider. Do not upload `.env`, `.venv`, `node_modules`, `.local` or Vercel CLI credentials to the repository. The existing client-side operator login is a prototype UI gate, not backend authorization.

## Verification

Run `pytest`, `cd frontend && npm test` and `npm run build`. After hosting, check the production passenger page and direct `/admin` navigation, map loading, `/health`, CORS preflight, journey search and the direct Render WebSocket. A production frontend without the backend URL is a deployed UI with API functionality pending.
