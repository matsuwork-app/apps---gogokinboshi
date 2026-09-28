-- Replace an event's current team membership between matches while preserving
-- the immutable lineup snapshot already stored for every created match.

begin;

create or replace function public.reassign_event_team_members(
  p_event_id uuid,
  p_assignments jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_count integer;
  v_assignment_count integer;
  v_distinct_member_count integer;
begin
  if p_event_id is null then
    raise exception 'event_id is required';
  end if;

  -- Serialize against create_match_with_teams, which uses the same event lock.
  -- This guarantees a new match either snapshots the updated membership or is
  -- created first and causes this operation to reject as unfinished.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_event_id::text, 0)
  );

  perform 1
  from public.events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'event does not exist';
  end if;

  if exists (
    select 1
    from public.matches
    where event_id = p_event_id
      and status in ('pending', 'active', 'paused')
  ) then
    raise exception 'event has an unfinished match';
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

  select count(*)
  into v_participant_count
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

  delete from public.event_team_members
  where event_id = p_event_id;

  insert into public.event_team_members (event_id, event_team_id, member_id)
  select
    p_event_id,
    (assignment->>'event_team_id')::uuid,
    (assignment->>'member_id')::uuid
  from jsonb_array_elements(p_assignments) assignment;
end;
$$;

comment on function public.reassign_event_team_members(uuid, jsonb) is
  'Atomically replaces current event team membership. p_assignments: [{"member_id":"uuid","event_team_id":"uuid"}]. Existing match lineups are unchanged.';

revoke all on function public.reassign_event_team_members(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.reassign_event_team_members(uuid, jsonb)
  to service_role;

commit;
