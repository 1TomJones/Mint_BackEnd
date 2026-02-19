create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

drop policy if exists "authenticated_users_select_own_allowlist_row" on public.admin_allowlist;
create policy "authenticated_users_select_own_allowlist_row"
  on public.admin_allowlist
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

grant select on table public.admin_allowlist to authenticated;
