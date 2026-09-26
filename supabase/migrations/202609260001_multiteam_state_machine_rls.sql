-- Multi-team events, durable match timing, atomic creation/state transitions,
-- and a read-public/write-service-role-only permission boundary.
--
-- This migration intentionally fails (and rolls back in full) when legacy rows
-- violate a new invariant. It never renumbers matches or rewrites timestamps.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

alter table public.events
  add column if not exists team_count integer;

update public.events set team_count = 2 where team_count is null;

alter table public.events
  alter column team_count set default 2,
  alter column team_count set not null;

alter table public.events drop constraint if exists events_team_count_check;
alter table public.events
  add constraint events_team_count_check check (team_count between 2 and 4);

create table if not exists public.event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_code text not null check (team_code in ('A', 'B', 'C', 'D')),
  display_name text not null,
  sort_order integer not null check (sort_order between 1 and 4),
  created_at timestamptz not null default now(),
  unique (event_id, team_code),
  unique (event_id, sort_order),
  unique (event_id, id)
);

create table if not exists public.event_team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  event_team_id uuid not null,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_team_members_team_fkey
    foreign key (event_id, event_team_id)
    references public.event_teams(event_id, id) on delete cascade,
  unique (event_id, member_id),
  unique (event_team_id, member_id)
);

alter table public.event_team_members
  drop constraint if exists event_team_members_participant_fkey;
alter table public.event_team_members
  add constraint event_team_members_participant_fkey
  foreign key (event_id, member_id)
  references public.event_participants(event_id, member_id) on delete cascade;

-- Every legacy event gets stable A/B teams, including events without matches.
insert into public.event_teams (event_id, team_code, display_name, sort_order)
select e.id, v.team_code, v.display_name, v.sort_order
from public.events e
cross join (values ('A', 'チームA', 1), ('B', 'チームB', 2))
  as v(team_code, display_name, sort_order)
on conflict (event_id, team_code) do nothing;

alter table public.matches
  add column if not exists elapsed_seconds integer,
  add column if not exists active_started_at timestamptz;

update public.matches
set elapsed_seconds = case
  when started_at is null then 0
  when status = 'finished' and ended_at is not null
    then greatest(0, floor(extract(epoch from ended_at - started_at))::integer)
  else greatest(0, floor(extract(epoch from now() - started_at))::integer)
end
where elapsed_seconds is null;

alter table public.matches
  alter column elapsed_seconds set default 0,
  alter column elapsed_seconds set not null;

-- Legacy active rows did not distinguish elapsed accumulated time from the
-- current running segment. Preserve their original start as that segment start.
update public.matches
set active_started_at = started_at,
    elapsed_seconds = 0
where status = 'active'
  and active_started_at is null
  and started_at is not null;

do $$
begin
  if exists (
    select 1 from public.matches
    where status = 'active' and started_at is null
  ) then
    raise exception 'Cannot migrate active match without started_at';
  end if;
end
$$;

alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches drop constraint if exists matches_elapsed_seconds_check;
alter table public.matches drop constraint if exists matches_ended_after_started_check;
alter table public.matches drop constraint if exists matches_status_timestamps_check;
alter table public.matches
  add constraint matches_status_check
    check (status in ('pending', 'active', 'paused', 'finished')),
  add constraint matches_elapsed_seconds_check check (elapsed_seconds >= 0),
  add constraint matches_ended_after_started_check
    check (ended_at is null or (started_at is not null and ended_at >= started_at)),
  add constraint matches_status_timestamps_check check (
    (status = 'pending' and started_at is null and ended_at is null and active_started_at is null)
    or (status = 'active' and started_at is not null and ended_at is null and active_started_at is not null)
    or (status = 'paused' and started_at is not null and ended_at is null and active_started_at is null)
    or (status = 'finished' and started_at is not null and ended_at is not null and active_started_at is null)
  );

do $$
begin
  if exists (
    select 1 from public.matches
    group by event_id, match_number having count(*) > 1
  ) then
    raise exception 'Cannot add matches(event_id, match_number) uniqueness: duplicate legacy rows exist';
  end if;

  if exists (
    select 1 from public.playing_intervals
    where ended_at is not null and ended_at < started_at
  ) then
    raise exception 'Cannot enforce interval ordering: ended_at precedes started_at';
  end if;

  if exists (
    select 1 from public.playing_intervals
    where ended_at is null
    group by match_id, member_id having count(*) > 1
  ) then
    raise exception 'Cannot enforce one open interval: duplicate open legacy intervals exist';
  end if;
end
$$;

create unique index if not exists matches_event_match_number_uidx
  on public.matches(event_id, match_number);
create unique index if not exists matches_id_event_uidx
  on public.matches(id, event_id);

create table if not exists public.match_teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  event_id uuid not null,
  event_team_id uuid not null,
  side smallint not null check (side in (1, 2)),
  created_at timestamptz not null default now(),
  constraint match_teams_match_fkey
    foreign key (match_id, event_id)
    references public.matches(id, event_id) on delete cascade,
  constraint match_teams_event_team_fkey
    foreign key (event_id, event_team_id)
    references public.event_teams(event_id, id),
  unique (match_id, side),
  unique (match_id, event_team_id),
  unique (match_id, id)
);

insert into public.match_teams (match_id, event_id, event_team_id, side)
select m.id, m.event_id, et.id, case et.team_code when 'A' then 1 else 2 end
from public.matches m
join public.event_teams et
  on et.event_id = m.event_id and et.team_code in ('A', 'B')
on conflict (match_id, side) do nothing;

alter table public.match_lineups
  add column if not exists match_team_id uuid,
  add column if not exists is_playing boolean;

update public.match_lineups
set is_playing = true
where is_playing is null;

alter table public.match_lineups
  alter column is_playing set default true,
  alter column is_playing set not null;

update public.match_lineups ml
set match_team_id = mt.id
from public.match_teams mt
where mt.match_id = ml.match_id
  and mt.side = case ml.team when 'A' then 1 when 'B' then 2 end
  and ml.match_team_id is null;

do $$
begin
  if exists (select 1 from public.match_lineups where match_team_id is null) then
    raise exception 'Could not backfill match_lineups.match_team_id for every legacy lineup';
  end if;
end
$$;

alter table public.match_lineups
  alter column match_team_id set not null;

alter table public.match_lineups
  drop constraint if exists match_lineups_match_team_fkey;
alter table public.match_lineups
  add constraint match_lineups_match_team_fkey
  foreign key (match_id, match_team_id)
  references public.match_teams(match_id, id);

do $$
begin
  if exists (
    select 1
    from public.goals g
    where not exists (
      select 1 from public.match_lineups ml
      where ml.match_id = g.match_id and ml.member_id = g.member_id
    )
  ) then
    raise exception 'Cannot link goals to lineups: legacy goal exists outside its match lineup';
  end if;

  if exists (
    select 1
    from public.playing_intervals pi
    where not exists (
      select 1 from public.match_lineups ml
      where ml.match_id = pi.match_id and ml.member_id = pi.member_id
    )
  ) then
    raise exception 'Cannot link playing intervals to lineups: legacy interval exists outside its match lineup';
  end if;
end
$$;

alter table public.goals
  drop constraint if exists goals_match_lineup_fkey;
alter table public.goals
  add constraint goals_match_lineup_fkey
  foreign key (match_id, member_id)
  references public.match_lineups(match_id, member_id);

alter table public.playing_intervals
  drop constraint if exists playing_intervals_match_lineup_fkey;
alter table public.playing_intervals
  add constraint playing_intervals_match_lineup_fkey
  foreign key (match_id, member_id)
  references public.match_lineups(match_id, member_id);

-- Infer event-level membership only when every legacy lineup for the member in
-- that event agrees on one team. Players who changed A/B across matches remain
-- intentionally unassigned rather than receiving fabricated membership.
with stable_membership as (
  select m.event_id, ml.member_id, min(ml.team) as team_code
  from public.match_lineups ml
  join public.matches m on m.id = ml.match_id
  group by m.event_id, ml.member_id
  having count(distinct ml.team) = 1
)
insert into public.event_team_members (event_id, event_team_id, member_id)
select sm.event_id, et.id, sm.member_id
from stable_membership sm
join public.event_teams et
  on et.event_id = sm.event_id and et.team_code = sm.team_code
join public.event_participants ep
  on ep.event_id = sm.event_id and ep.member_id = sm.member_id
on conflict (event_id, member_id) do nothing;

alter table public.playing_intervals
  drop constraint if exists playing_intervals_ended_after_started_check;
alter table public.playing_intervals
  add constraint playing_intervals_ended_after_started_check
  check (ended_at is null or ended_at >= started_at);

-- A legacy finished match can contain an interval the old client forgot to
-- close. The production preflight found one such row; the match end is later
-- than the interval start, so it is safe to use as the missing end time.
update public.playing_intervals pi
set ended_at = m.ended_at
from public.matches m
where m.id = pi.match_id
  and m.status = 'finished'
  and pi.ended_at is null
  and m.ended_at is not null
  and m.ended_at >= pi.started_at;

do $$
begin
  if exists (
    select 1
    from public.playing_intervals pi
    join public.matches m on m.id = pi.match_id
    where pi.ended_at is null and m.status <> 'active'
  ) then
    raise exception 'Cannot migrate open playing interval for a non-active match';
  end if;
end
$$;

create unique index if not exists playing_intervals_one_open_per_player_uidx
  on public.playing_intervals(match_id, member_id)
  where ended_at is null;

create index if not exists events_event_date_idx
  on public.events(event_date desc);
create index if not exists event_participants_member_idx
  on public.event_participants(member_id);
create index if not exists event_teams_event_idx
  on public.event_teams(event_id, sort_order);
create index if not exists event_team_members_team_idx
  on public.event_team_members(event_team_id);
create index if not exists event_team_members_member_idx
  on public.event_team_members(member_id);
create index if not exists matches_event_created_idx
  on public.matches(event_id, created_at desc);
create index if not exists match_teams_event_team_idx
  on public.match_teams(event_team_id);
create index if not exists match_lineups_member_idx
  on public.match_lineups(member_id);
create index if not exists match_lineups_match_team_idx
  on public.match_lineups(match_team_id);
create index if not exists goals_match_scored_idx
  on public.goals(match_id, scored_at);
create index if not exists goals_member_idx
  on public.goals(member_id);
create index if not exists playing_intervals_match_member_idx
  on public.playing_intervals(match_id, member_id);

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
    select 1 from jsonb_array_elements(p_teams) t
    where jsonb_typeof(t->'member_ids') is distinct from 'array'
       or coalesce(jsonb_array_length(t->'member_ids'), 0) = 0
  ) then
    raise exception 'each team must contain at least one member';
  end if;

  select count(*), count(distinct member_id)
  into v_member_total, v_member_distinct
  from (
    select jsonb_array_elements_text(t->'member_ids')::uuid as member_id
    from jsonb_array_elements(p_teams) t
  ) members_input;
  if v_member_total <> v_member_distinct then
    raise exception 'a member can belong to only one event team';
  end if;
  if (select count(*) from public.members where id in (
        select jsonb_array_elements_text(t->'member_ids')::uuid
        from jsonb_array_elements(p_teams) t
      )) <> v_member_distinct then
    raise exception 'one or more members do not exist';
  end if;

  insert into public.events (event_date, notes, team_count)
  values (p_event_date, nullif(btrim(p_notes), ''), v_team_count)
  returning id into v_event_id;

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
    end loop;
  end loop;

  return v_event_id;
end;
$$;

comment on function public.create_event_with_teams(date, text, jsonb) is
  'Atomically creates an event, 2-4 teams, participants, and event membership. p_teams: [{"name":"...","member_ids":["uuid"]}]';

create or replace function public.create_match_with_teams(
  p_event_id uuid,
  p_event_team_ids uuid[],
  p_lineups jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match_id uuid;
  v_match_number integer;
  v_team_id uuid;
  v_match_team_id uuid;
  v_side integer;
  v_lineup jsonb;
  v_member_id uuid;
begin
  if p_event_id is null or not exists (
    select 1 from public.events where id = p_event_id
  ) then
    raise exception 'event does not exist';
  end if;
  if coalesce(cardinality(p_event_team_ids), 0) <> 2
     or (select count(distinct team_id) from unnest(p_event_team_ids) team_id) <> 2 then
    raise exception 'exactly two distinct event teams are required';
  end if;
  if (select count(*) from public.event_teams
      where event_id = p_event_id and id = any(p_event_team_ids)) <> 2 then
    raise exception 'both teams must belong to the event';
  end if;

  -- Transaction-scoped lock makes max()+1 safe for this event.
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));
  select coalesce(max(match_number), 0) + 1
  into v_match_number
  from public.matches
  where event_id = p_event_id;

  insert into public.matches (event_id, match_number)
  values (p_event_id, v_match_number)
  returning id into v_match_id;

  for v_side in 1..2 loop
    v_team_id := p_event_team_ids[v_side];
    insert into public.match_teams (match_id, event_id, event_team_id, side)
    values (v_match_id, p_event_id, v_team_id, v_side)
    returning id into v_match_team_id;
  end loop;

  if p_lineups is null then
    insert into public.match_lineups
      (match_id, member_id, team, match_team_id)
    select
      v_match_id,
      etm.member_id,
      case mt.side when 1 then 'A' else 'B' end,
      mt.id
    from public.match_teams mt
    join public.event_team_members etm
      on etm.event_id = p_event_id and etm.event_team_id = mt.event_team_id
    where mt.match_id = v_match_id;
  else
    if jsonb_typeof(p_lineups) <> 'array' or jsonb_array_length(p_lineups) < 2 then
      raise exception 'lineups must be an array with at least two players';
    end if;
    if (select count(*) from jsonb_array_elements(p_lineups)) <>
       (select count(distinct (x->>'member_id')::uuid) from jsonb_array_elements(p_lineups) x) then
      raise exception 'a player can appear only once in a match lineup';
    end if;

    for v_lineup in select value from jsonb_array_elements(p_lineups)
    loop
      v_member_id := (v_lineup->>'member_id')::uuid;
      v_team_id := (v_lineup->>'event_team_id')::uuid;
      select mt.id, mt.side into v_match_team_id, v_side
      from public.match_teams mt
      join public.event_team_members etm
        on etm.event_id = p_event_id
       and etm.event_team_id = mt.event_team_id
       and etm.member_id = v_member_id
      where mt.match_id = v_match_id and mt.event_team_id = v_team_id;
      if not found then
        raise exception 'lineup player is not a member of the selected event team';
      end if;
      insert into public.match_lineups (match_id, member_id, team, match_team_id)
      values (v_match_id, v_member_id,
              case v_side when 1 then 'A' else 'B' end, v_match_team_id);
    end loop;
  end if;

  if exists (
    select 1 from public.match_teams mt
    where mt.match_id = v_match_id
      and not exists (
        select 1 from public.match_lineups ml where ml.match_team_id = mt.id
      )
  ) then
    raise exception 'each selected team must have at least one lineup player';
  end if;

  return v_match_id;
end;
$$;

comment on function public.create_match_with_teams(uuid, uuid[], jsonb) is
  'Atomically creates the next numbered match for two event teams. Optional p_lineups: [{"member_id":"uuid","event_team_id":"uuid"}]';

create or replace function public.transition_match(
  p_match_id uuid,
  p_expected_status text,
  p_next_status text
) returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_segment_seconds integer := 0;
  v_occurred_at timestamptz := clock_timestamp();
begin
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;
  if not found then
    raise exception 'match does not exist';
  end if;
  if v_match.status <> p_expected_status then
    raise exception 'status conflict: expected %, actual %', p_expected_status, v_match.status;
  end if;
  if not (
    (p_expected_status = 'pending' and p_next_status = 'active') or
    (p_expected_status = 'active' and p_next_status in ('paused', 'finished')) or
    (p_expected_status = 'paused' and p_next_status in ('active', 'finished'))
  ) then
    raise exception 'invalid match transition: % -> %', p_expected_status, p_next_status;
  end if;
  if v_match.started_at is not null and v_occurred_at < v_match.started_at then
    raise exception 'occurred_at cannot precede match start';
  end if;
  if p_expected_status = 'active' and v_match.active_started_at is null then
    raise exception 'active match has no active_started_at';
  end if;
  if v_match.active_started_at is not null then
    if v_occurred_at < v_match.active_started_at then
      raise exception 'occurred_at cannot precede active segment start';
    end if;
    v_segment_seconds := floor(extract(epoch from v_occurred_at - v_match.active_started_at))::integer;
  end if;

  if p_expected_status = 'pending' then
    update public.matches
    set status = 'active', started_at = v_occurred_at,
        active_started_at = v_occurred_at, elapsed_seconds = 0,
        ended_at = null
    where id = p_match_id
    returning * into v_match;
    insert into public.playing_intervals (match_id, member_id, started_at)
    select p_match_id, ml.member_id, v_occurred_at
    from public.match_lineups ml
    where ml.match_id = p_match_id and ml.is_playing
    on conflict (match_id, member_id) where ended_at is null do nothing;
  elsif p_next_status = 'paused' then
    update public.matches
    set status = 'paused',
        elapsed_seconds = elapsed_seconds + v_segment_seconds,
        active_started_at = null
    where id = p_match_id
    returning * into v_match;
    update public.playing_intervals
    set ended_at = v_occurred_at
    where match_id = p_match_id and ended_at is null;
  elsif p_expected_status = 'paused' and p_next_status = 'active' then
    update public.matches
    set status = 'active', active_started_at = v_occurred_at
    where id = p_match_id
    returning * into v_match;
    insert into public.playing_intervals (match_id, member_id, started_at)
    select p_match_id, ml.member_id, v_occurred_at
    from public.match_lineups ml
    where ml.match_id = p_match_id and ml.is_playing
    on conflict (match_id, member_id) where ended_at is null do nothing;
  else
    update public.matches
    set status = 'finished', ended_at = v_occurred_at,
        elapsed_seconds = elapsed_seconds + v_segment_seconds,
        active_started_at = null
    where id = p_match_id
    returning * into v_match;
    update public.playing_intervals
    set ended_at = v_occurred_at
    where match_id = p_match_id and ended_at is null;
  end if;

  return v_match;
end;
$$;

comment on function public.transition_match(uuid, text, text) is
  'CAS-style atomic transition for pending/active/paused/finished; closes open playing intervals on pause/finish.';

create or replace function public.set_player_playing(
  p_match_id uuid,
  p_member_id uuid,
  p_is_playing boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_occurred_at timestamptz := clock_timestamp();
begin
  select status into v_status
  from public.matches
  where id = p_match_id
  for update;
  if not found then
    raise exception 'match does not exist';
  end if;
  if v_status = 'finished' then
    raise exception 'finished match cannot change playing players';
  end if;

  update public.match_lineups
  set is_playing = p_is_playing
  where match_id = p_match_id and member_id = p_member_id;
  if not found then
    raise exception 'player is not in the match lineup';
  end if;

  if v_status = 'active' and p_is_playing then
    insert into public.playing_intervals (match_id, member_id, started_at)
    values (p_match_id, p_member_id, v_occurred_at)
    on conflict (match_id, member_id) where ended_at is null do nothing;
  elsif v_status = 'active' and not p_is_playing then
    update public.playing_intervals
    set ended_at = v_occurred_at
    where match_id = p_match_id
      and member_id = p_member_id
      and ended_at is null;
  end if;
end;
$$;

comment on function public.set_player_playing(uuid, uuid, boolean) is
  'Atomically persists lineup playing state and opens/closes the active playing interval.';

-- Public data is readable without login. Mutations are deliberately unavailable
-- through anon/authenticated PostgREST; trusted server code must use service_role.
do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'members', 'events', 'event_participants', 'event_teams',
    'event_team_members', 'matches', 'match_teams', 'match_lineups',
    'goals', 'playing_intervals'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
    end loop;
    execute format(
      'create policy public_read on public.%I for select to anon, authenticated using (true)',
      v_table
    );
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select on table public.%I to anon, authenticated', v_table);
    execute format('grant all on table public.%I to service_role', v_table);
  end loop;
end
$$;

revoke all on function public.create_event_with_teams(date, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.create_match_with_teams(uuid, uuid[], jsonb)
  from public, anon, authenticated;
revoke all on function public.transition_match(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.set_player_playing(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.create_event_with_teams(date, text, jsonb)
  to service_role;
grant execute on function public.create_match_with_teams(uuid, uuid[], jsonb)
  to service_role;
grant execute on function public.transition_match(uuid, text, text)
  to service_role;
grant execute on function public.set_player_playing(uuid, uuid, boolean)
  to service_role;

commit;
