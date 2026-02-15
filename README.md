# Mint Backend (Render + Supabase)

Minimal TypeScript/Node.js service that bridges:
- Mint website
- Supabase data
- External simulation providers

## Features

- `POST /api/runs/create`
  - Requires header `x-user-id` (exact header name) for MVP user identity.
  - Validates event by code.
  - Creates a run for a user.
  - Returns a simulation URL with `run_id` query param.
- `POST /api/runs/submit`
  - Accepts simulation output.
  - Validates run exists.
  - Blocks duplicate submissions.
  - Writes to `run_results` and marks run finished.
- `GET /api/events/:code/leaderboard`
  - Returns ranked entries for an event.
  - Resolves display name from user metadata, falls back to masked email.

## Environment Variables

Set these on Render (and locally in `.env` for development):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
- `MINT_SITE_URL` (allowed CORS origin for Mint frontend, e.g. `https://mint.example.com`)
- `SIM_SITE_URL` (allowed CORS origin for simulation frontend, e.g. `https://sim.example.com`)
- `PORT` (optional, defaults to `3000`)

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

- `public.events`: `id`, `code`, `sim_url`
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
