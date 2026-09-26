-- Deterministic, fictional data for the disposable local E2E database only.
-- Never load production exports into the lifecycle test environment.

create table if not exists public.e2e_environment_guard (
  marker text primary key
);

alter table public.e2e_environment_guard enable row level security;
revoke all on table public.e2e_environment_guard from public, anon, authenticated;
grant select on table public.e2e_environment_guard to service_role;

insert into public.e2e_environment_guard (marker)
values ('gogokinboshi-lifecycle-e2e')
on conflict (marker) do nothing;

insert into public.members (id, name)
values
  ('10000000-0000-4000-8000-000000000001', 'E2E-A'),
  ('10000000-0000-4000-8000-000000000002', 'E2E-B'),
  ('10000000-0000-4000-8000-000000000003', 'E2E-C')
on conflict (id) do update set name = excluded.name;
