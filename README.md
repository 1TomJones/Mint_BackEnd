# Mint Backend (Render + Supabase)

Minimal TypeScript/Node.js service that bridges:
- Mint website
- Supabase data
- External simulation providers

## Features

- `POST /api/runs/create`
  - Uses `Authorization: Bearer <access_token>` as the required identity source.
  - Validates event by code.
  - Creates a run for a user.
  - Returns a simulation URL with `run_id`, `event_code`, and `scenario_id` query params.
- `POST /api/runs/submit`
  - Accepts simulation output.
  - Validates run exists.
  - Blocks duplicate submissions.
  - Only accepts submissions when the event state is `live` or `ended`.
  - Writes to `run_results` and marks run finished.
- `GET /api/events/:code/leaderboard`
  - Returns ranked entries for an event.
  - Resolves display name from user metadata, falls back to masked email.
- `GET /api/events/:code/status`
  - Returns event runtime status fields used by simulation clients.
- `POST /api/admin/sim-admin-link`
  - Requires a valid Supabase access token and admin allowlist membership.
  - Returns signed, short-lived admin URL for `admin.html`.
- `POST /api/admin/events/create`
  - Admin-only endpoint for creating events.
  - Accepts `event_code`, `event_name`, `scenario_id`, `duration_minutes`, and optional `sim_url`.
  - Stores `scenario_id` on `public.events` and returns `{ ok: true, event: ... }`.
- `POST /api/admin/events/:code/start|pause|resume|end`
  - Requires a valid Supabase access token and admin allowlist membership.
  - Controls event lifecycle state.
- `GET /api/admin/validate-token`
  - Verifies admin token integrity and expiration for sim admin page.

## Environment Variables

Set these on Render (and locally in `.env` for development):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
- `MINT_SITE_URL` (allowed CORS origin for Mint frontend, e.g. `https://mint.example.com`)
- `SIM_SITE_URL` (allowed CORS origin for simulation frontend, e.g. `https://sim.example.com`)
- `PORT` (optional, defaults to `3000`)
- `ADMIN_ALLOWLIST_EMAILS` (optional comma-separated admin emails used for admin endpoint access)
- `MINT_ADMIN_ORIGIN` (optional extra CORS origin for Mint admin host)
- `SIM_ORIGIN` (optional extra CORS origin for simulation host)
- `PORTFOLIO_SIM_URL` (optional fallback sim URL used by admin event creation when `sim_url` is omitted)

> Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

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

## Render deployment

1. Create a **Web Service** pointing to this repository.
2. Build command:
   ```bash
   npm install && npm run build
   ```
3. Start command:
   ```bash
   npm start
   ```
4. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MINT_SITE_URL`
   - `SIM_SITE_URL`
   - optionally `PORT`

## Suggested table expectations

- `public.events`: `id`, `code` (unique), `name`, `sim_type`, `sim_url`, `scenario_id`, `scenario_name` (optional), `state`, `duration_minutes`, `created_at`, `started_at`, `ended_at`
- `public.runs`: `id`, `event_id`, `user_id`, `finished_at`
- `public.run_results`: `run_id`, `score`, `pnl`, `sharpe`, `max_drawdown`, `win_rate`, `extra`

## Future extensions

Code is split by layers so future work is isolated:

- `routes/` for API endpoints
- `services/` for business logic
- `lib/` for integrations

This structure supports adding:
- submit tokens
- plan gating
- rate limiting
