alter table public.events
  add column if not exists scenario_id text;

alter table public.events
  add column if not exists scenario_name text;
