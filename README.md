# Mint Backend (Render + Supabase)

Minimal TypeScript/Node.js service that bridges Mint frontend and Supabase.

## Required Render environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_ALLOWLIST_EMAILS` (optional, comma-separated emails)
- `MINT_SITE_URL`
- `SIM_SITE_URL`
- `SIM_ADMIN_TOKEN` (required for admin join-link endpoints)

> `SUPABASE_SERVICE_ROLE_KEY` is backend-only. Never expose it to the frontend.

## Auth model

Backend request authentication uses **Supabase Auth access tokens only**:

- Clients send `Authorization: Bearer <accessToken>`.
- Backend validates token with `supabase.auth.getUser(accessToken)`.
- `x-user-id` is accepted but never trusted as identity source.
- `ADMIN_JWT_SECRET` is not required for request auth.

## Event creation endpoint

`POST /api/events/create`

Request body:

```json
{
  "code": "SPRING_2026",
  "name": "Spring Challenge",
  "description": "Optional description",
  "sim_url": "https://sim.example.com/play",
  "scenario_id": "scenario-1",
  "duration_minutes": 60
}
```

Behavior:

- 401 `{ "error": "unauthorized", "detail": "..." }` for invalid/missing token.
- 403 `{ "error": "forbidden", "detail": "email not in allowlist" }` when allowlist is configured and user email is not present.
- 201 `{ "event": { ...inserted row... } }` on success.
- Inserts into `public.events` with `status='draft'` by default unless `status` is explicitly provided.


## Admin auth routes

- `GET /health`
- `GET /api/admin/me` (canonical)
- `GET /admin/me` (legacy compatibility alias)
- `GET /api/admin/events`
- `POST /api/admin/events`
- `POST /api/admin/events/:code/state`
- `GET /api/admin/events/:code/sim-admin-link`
- `POST /api/admin/sim-admin-link`

`POST /api/admin/events` accepts both camelCase and snake_case keys for the sim/scenario/duration fields.

`GET /api/admin/me` reads `Authorization: Bearer <accessToken>`, resolves the user with Supabase auth, and returns:

```json
{ "isAdmin": true, "detail": null }
```

or

```json
{ "isAdmin": false, "detail": "email not in admin_allowlist" }
```

## Render deployment checklist

For the deployed backend service, verify:

- **Root Directory**: `backend-render` in the parent mono-repo (or this repository root if deploying this repo directly).
- **Start Command**: `npm start`
- **Build Command**: `npm install && npm run build`
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MINT_SITE_URL`, `SIM_SITE_URL`

On startup the service now logs version/commit and mounted admin route details to confirm the correct build is running.

## CORS

Allowed origins are `MINT_SITE_URL` and `SIM_SITE_URL`.
Allowed headers include `Authorization`, `Content-Type`, and `x-user-id`.

## Local development

```bash
npm install
npm run dev
```

Build and run production build:

```bash
npm run build
npm start
```

## Quick test steps

1. Get a Supabase user access token from your frontend session.
2. Create event:

```bash
curl -i -X POST "$BACKEND_URL/api/events/create" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-user-id: $USER_ID" \
  -H "Content-Type: application/json" \
  --data '{
    "code":"SPRING_2026",
    "name":"Spring Challenge",
    "description":"test",
    "sim_url":"https://sim.example.com/play",
    "scenario_id":"scenario-1",
    "duration_minutes":60
  }'
```

3. Verify `201` and inserted event payload.
4. If `ADMIN_ALLOWLIST_EMAILS` is set, test with a non-allowlisted account and verify `403`.
