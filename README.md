# Mint Backend (Render + Supabase)

Minimal TypeScript/Node.js service that bridges Mint frontend and Supabase.

## Required Render environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_ALLOWLIST_EMAILS` (optional, comma-separated emails)
- `MINT_SITE_URL`
- `SIM_SITE_URL`

> `SUPABASE_SERVICE_ROLE_KEY` is backend-only. Never expose it to the frontend.

## Auth model

Backend request authentication uses **Supabase Auth access tokens only**:

- Clients send `Authorization: Bearer <accessToken>`.
- Backend validates token with `supabase.auth.getUser(accessToken)`.
- `x-user-id` is accepted but never trusted as identity source.
- `ADMIN_JWT_SECRET` is not required for request auth.

## Health endpoint

- `GET /api/health` returns `200 { "ok": true, "service": "mint-backend" }`.

## Public event endpoints

- `GET /api/events/active` returns currently active events.
- `GET /api/events/by-code/:code` returns joinable event details for multiplayer join flows.

## Admin identity endpoint

- `GET /api/admin/me` returns `{ userId, email, isAdmin }` for the authenticated user.

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
