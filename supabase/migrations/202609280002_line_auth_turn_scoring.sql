-- LINE-authenticated access and immutable event-turn scoring.
-- Existing match history remains intact; new goals belong to an event turn.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  line_user_id text not null unique,
  display_name text not null,
  avatar_url text,
  role text not null default 'member'
    check (role in ('admin', 'member')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_app_user_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_app_user_updated_at();

revoke all on function public.set_app_user_updated_at() from public, anon, authenticated;

create table if not exists public.event_turns (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  turn_number integer not null check (turn_number > 0),
  created_at timestamptz not null default now(),
  unique (event_id, turn_number),
  unique (id, event_id)
);

create table if not exists public.turn_team_members (
  id uuid primary key default gen_random_uuid(),
  event_turn_id uuid not null,
  event_id uuid not null,
  event_team_id uuid not null,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint turn_team_members_turn_fkey
    foreign key (event_turn_id, event_id)
    references public.event_turns(id, event_id) on delete cascade,
  constraint turn_team_members_team_fkey
    foreign key (event_id, event_team_id)
    references public.event_teams(event_id, id),
  constraint turn_team_members_participant_fkey
    foreign key (event_id, member_id)
    references public.event_participants(event_id, member_id) on delete cascade,
  unique (event_turn_id, member_id),
  unique (event_turn_id, event_team_id, member_id)
);

create index if not exists app_users_status_idx
  on public.app_users(status);
create index if not exists event_turns_event_created_idx
  on public.event_turns(event_id, turn_number desc);
create index if not exists turn_team_members_team_idx
  on public.turn_team_members(event_turn_id, event_team_id);
create index if not exists turn_team_members_member_idx
  on public.turn_team_members(member_id);

-- Preserve every existing event by snapshotting its current team assignment as
-- turn 1. Re-running the migration does not create duplicate turns or members.
insert into public.event_turns (event_id, turn_number)
select e.id, 1
from public.events e
on conflict (event_id, turn_number) do nothing;

insert into public.turn_team_members
  (event_turn_id, event_id, event_team_id, member_id)
select turn.id, membership.event_id, membership.event_team_id, membership.member_id
from public.event_turns turn
join public.event_team_members membership on membership.event_id = turn.event_id
where turn.turn_number = 1
on conflict (event_turn_id, member_id) do nothing;

alter table public.goals
  add column if not exists event_turn_id uuid;

alter table public.goals
  alter column match_id drop not null;

alter table public.goals
  drop constraint if exists goals_exactly_one_owner_check;
alter table public.goals
  add constraint goals_exactly_one_owner_check
  check (num_nonnulls(match_id, event_turn_id) = 1);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.goals'::regclass
      and conname = 'goals_turn_member_fkey'
  ) then
    alter table public.goals
      add constraint goals_turn_member_fkey
      foreign key (event_turn_id, member_id)
      references public.turn_team_members(event_turn_id, member_id)
      on delete cascade;
  end if;
end
$$;

create index if not exists goals_turn_scored_idx
  on public.goals(event_turn_id, scored_at)
  where event_turn_id is not null;

create or replace function public.create_event_with_teams(
  p_event_date date,
  p_notes text,
  p_teams jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_turn_id uuid;
  v_team_id uuid;
  v_team jsonb;
  v_team_count integer;
  v_index integer := 0;
  v_member_id uuid;
  v_member_total integer;
  v_member_distinct integer;
begin
  if p_event_date is null then
    raise exception 'event_date is required';
  end if;
  if p_teams is null or jsonb_typeof(p_teams) <> 'array' then
    raise exception 'teams must be a JSON array';
  end if;

  v_team_count := jsonb_array_length(p_teams);
  if v_team_count not between 2 and 4 then
    raise exception 'team count must be between 2 and 4';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_teams) team
    where jsonb_typeof(team->'member_ids') is distinct from 'array'
       or coalesce(jsonb_array_length(team->'member_ids'), 0) = 0
  ) then
    raise exception 'each team must contain at least one member';
  end if;

  select count(*), count(distinct member_id)
  into v_member_total, v_member_distinct
  from (
    select jsonb_array_elements_text(team->'member_ids')::uuid as member_id
    from jsonb_array_elements(p_teams) team
  ) members_input;
  if v_member_total <> v_member_distinct then
    raise exception 'a member can belong to only one event team';
  end if;
  if (
    select count(*) from public.members
    where id in (
      select jsonb_array_elements_text(team->'member_ids')::uuid
      from jsonb_array_elements(p_teams) team
    )
  ) <> v_member_distinct then
    raise exception 'one or more members do not exist';
  end if;

  insert into public.events (event_date, notes, team_count)
  values (p_event_date, nullif(btrim(p_notes), ''), v_team_count)
  returning id into v_event_id;

  insert into public.event_turns (event_id, turn_number)
  values (v_event_id, 1)
  returning id into v_turn_id;

  for v_team in select value from jsonb_array_elements(p_teams)
  loop
    v_index := v_index + 1;
    insert into public.event_teams
      (event_id, team_code, display_name, sort_order)
    values (
      v_event_id,
      chr(64 + v_index),
      coalesce(nullif(btrim(v_team->>'name'), ''), 'チーム' || chr(64 + v_index)),
      v_index
    ) returning id into v_team_id;

    for v_member_id in
      select jsonb_array_elements_text(v_team->'member_ids')::uuid
    loop
      insert into public.event_participants (event_id, member_id)
      values (v_event_id, v_member_id);
      insert into public.event_team_members (event_id, event_team_id, member_id)
      values (v_event_id, v_team_id, v_member_id);
      insert into public.turn_team_members
        (event_turn_id, event_id, event_team_id, member_id)
      values (v_turn_id, v_event_id, v_team_id, v_member_id);
    end loop;
  end loop;

  return v_event_id;
end;
$$;

comment on function public.create_event_with_teams(date, text, jsonb) is
  'Atomically creates an event, 2-4 teams, participants, current membership, and immutable turn 1.';

create or replace function public.create_event_turn(
  p_event_id uuid,
  p_assignments jsonb
) returns table (turn_id uuid, turn_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turn_id uuid;
  v_turn_number integer;
  v_participant_count integer;
  v_assignment_count integer;
  v_distinct_member_count integer;
begin
  if p_event_id is null then
    raise exception 'event_id is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_event_id::text, 0)
  );

  perform 1 from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event does not exist';
  end if;

  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'assignments must be a JSON array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    where jsonb_typeof(assignment) <> 'object'
       or jsonb_typeof(assignment->'member_id') is distinct from 'string'
       or jsonb_typeof(assignment->'event_team_id') is distinct from 'string'
  ) then
    raise exception 'each assignment must contain member_id and event_team_id';
  end if;

  select count(*) into v_participant_count
  from public.event_participants
  where event_id = p_event_id;

  select count(*), count(distinct (assignment->>'member_id')::uuid)
  into v_assignment_count, v_distinct_member_count
  from jsonb_array_elements(p_assignments) assignment;

  if v_assignment_count <> v_participant_count
     or v_distinct_member_count <> v_participant_count then
    raise exception 'assignments must include every event participant exactly once';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    left join public.event_participants participant
      on participant.event_id = p_event_id
     and participant.member_id = (assignment->>'member_id')::uuid
    where participant.member_id is null
  ) then
    raise exception 'assignments must include every event participant exactly once';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_assignments) assignment
    left join public.event_teams team
      on team.event_id = p_event_id
     and team.id = (assignment->>'event_team_id')::uuid
    where team.id is null
  ) then
    raise exception 'every assigned team must belong to the event';
  end if;
  if exists (
    select 1
    from public.event_teams team
    where team.event_id = p_event_id
      and not exists (
        select 1
        from jsonb_array_elements(p_assignments) assignment
        where (assignment->>'event_team_id')::uuid = team.id
      )
  ) then
    raise exception 'every event team must have at least one member';
  end if;

  select coalesce(max(existing_turn.turn_number), 0) + 1
  into v_turn_number
  from public.event_turns existing_turn
  where existing_turn.event_id = p_event_id;

  insert into public.event_turns (event_id, turn_number)
  values (p_event_id, v_turn_number)
  returning id into v_turn_id;

  delete from public.event_team_members where event_id = p_event_id;

  insert into public.event_team_members (event_id, event_team_id, member_id)
  select
    p_event_id,
    (assignment->>'event_team_id')::uuid,
    (assignment->>'member_id')::uuid
  from jsonb_array_elements(p_assignments) assignment;

  insert into public.turn_team_members
    (event_turn_id, event_id, event_team_id, member_id)
  select
    v_turn_id,
    p_event_id,
    (assignment->>'event_team_id')::uuid,
    (assignment->>'member_id')::uuid
  from jsonb_array_elements(p_assignments) assignment;

  return query select v_turn_id, v_turn_number;
end;
$$;

comment on function public.create_event_turn(uuid, jsonb) is
  'Creates the next immutable turn snapshot, atomically replaces current event team membership, and returns its id and number.';

drop function if exists public.get_public_rankings(date, date);

create or replace function public.get_public_rankings(
  p_from_date date,
  p_to_date date
) returns table (
  member_id uuid,
  name text,
  total_goals bigint,
  participated_events bigint,
  total_events bigint,
  rank bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_from_date is null or p_to_date is null then
    raise exception 'from date and to date are required';
  end if;
  if p_from_date > p_to_date then
    raise exception 'from date must not be after to date';
  end if;
  if p_to_date - p_from_date > 3660 then
    raise exception 'ranking period must not exceed 3660 days';
  end if;

  return query
  with bounds as (
    select
      p_from_date::timestamp at time zone 'Asia/Tokyo' as from_at,
      (p_to_date + 1)::timestamp at time zone 'Asia/Tokyo' as to_at
  ),
  event_total as (
    select count(*)::bigint as count
    from public.events event
    where event.event_date between p_from_date and p_to_date
  ),
  legacy_goals as (
    select goal.member_id, count(*)::bigint as count
    from public.goals goal
    join public.matches match on match.id = goal.match_id
    cross join bounds bound
    where goal.match_id is not null
      and match.started_at >= bound.from_at
      and match.started_at < bound.to_at
    group by goal.member_id
  ),
  turn_goals as (
    select goal.member_id, count(*)::bigint as count
    from public.goals goal
    join public.event_turns turn on turn.id = goal.event_turn_id
    join public.events event on event.id = turn.event_id
    where goal.event_turn_id is not null
      and event.event_date between p_from_date and p_to_date
    group by goal.member_id
  ),
  goals_by_member as (
    select combined.member_id, sum(combined.count)::bigint as count
    from (
      select * from legacy_goals
      union all
      select * from turn_goals
    ) combined
    group by combined.member_id
  ),
  participation_by_member as (
    select participant.member_id, count(*)::bigint as count
    from public.event_participants participant
    join public.events event on event.id = participant.event_id
    where event.event_date between p_from_date and p_to_date
    group by participant.member_id
  ),
  member_totals as (
    select
      member.id as member_id,
      member.name,
      coalesce(goal.count, 0)::bigint as total_goals,
      coalesce(participation.count, 0)::bigint as participated_events,
      event_total.count::bigint as total_events,
      member.created_at
    from public.members member
    cross join event_total
    left join goals_by_member goal on goal.member_id = member.id
    left join participation_by_member participation on participation.member_id = member.id
  )
  select
    total.member_id,
    total.name,
    total.total_goals,
    total.participated_events,
    total.total_events,
    rank() over (order by total.total_goals desc)::bigint as rank
  from member_totals total
  order by total.total_goals desc, total.created_at asc, total.member_id asc;
end;
$$;

comment on function public.get_public_rankings(date, date) is
  'Returns goal rankings for an inclusive JST date range, combining legacy match goals and event-turn goals.';

create or replace function public.is_approved_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users app_user
    where app_user.auth_user_id = auth.uid()
      and app_user.status = 'approved'
  );
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users app_user
    where app_user.auth_user_id = auth.uid()
      and app_user.status = 'approved'
      and app_user.role = 'admin'
  );
$$;

do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'members', 'events', 'event_participants', 'event_teams',
    'event_team_members', 'event_turns', 'turn_team_members',
    'matches', 'match_teams', 'match_lineups', 'goals',
    'playing_intervals'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    for v_policy in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
    end loop;
    execute format(
      'create policy approved_read on public.%I for select to authenticated using (public.is_approved_app_user())',
      v_table
    );
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select on table public.%I to authenticated', v_table);
    execute format('grant all on table public.%I to service_role', v_table);
  end loop;

  alter table public.app_users enable row level security;
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'app_users'
  loop
    execute format('drop policy %I on public.app_users', v_policy.policyname);
  end loop;
end
$$;

create policy app_users_self_or_admin_read
  on public.app_users
  for select
  to authenticated
  using (auth_user_id = auth.uid() or public.is_app_admin());

revoke all on table public.app_users from public, anon, authenticated;
grant select on table public.app_users to authenticated;
grant all on table public.app_users to service_role;

revoke all on function public.is_approved_app_user() from public, anon;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_approved_app_user() to authenticated, service_role;
grant execute on function public.is_app_admin() to authenticated, service_role;

revoke all on function public.create_event_with_teams(date, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.create_event_turn(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_public_rankings(date, date)
  from public, anon;
grant execute on function public.create_event_with_teams(date, text, jsonb)
  to service_role;
grant execute on function public.create_event_turn(uuid, jsonb)
  to service_role;
grant execute on function public.get_public_rankings(date, date)
  to authenticated, service_role;

commit;
