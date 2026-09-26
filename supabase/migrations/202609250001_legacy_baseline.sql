-- Legacy production baseline.
--
-- On the existing project every statement is a no-op because these tables
-- already exist. On a fresh/local project this creates the schema that the
-- following multi-team migration upgrades.

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, member_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  match_number integer not null default 1,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'finished')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.match_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  team text not null check (team in ('A', 'B')),
  created_at timestamptz default now(),
  unique (match_id, member_id)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  scored_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.playing_intervals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);
