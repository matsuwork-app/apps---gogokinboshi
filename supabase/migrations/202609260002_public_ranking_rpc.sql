-- Aggregate the public ranking in PostgreSQL so the application never needs to
-- download every goal, participation, and playing-interval detail row.

begin;

create index if not exists matches_started_at_idx
  on public.matches(started_at)
  where started_at is not null;

create or replace function public.get_public_rankings(
  p_from_date date,
  p_to_date date
) returns table (
  member_id uuid,
  name text,
  total_goals bigint,
  participated_events bigint,
  total_events bigint,
  total_seconds bigint,
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
    from public.events e
    where e.event_date between p_from_date and p_to_date
  ),
  goals_by_member as (
    select g.member_id, count(*)::bigint as count
    from public.goals g
    join public.matches ma on ma.id = g.match_id
    cross join bounds b
    where ma.started_at >= b.from_at and ma.started_at < b.to_at
    group by g.member_id
  ),
  participation_by_member as (
    select ep.member_id, count(*)::bigint as count
    from public.event_participants ep
    join public.events e on e.id = ep.event_id
    where e.event_date between p_from_date and p_to_date
    group by ep.member_id
  ),
  seconds_by_member as (
    select
      pi.member_id,
      coalesce(sum(floor(extract(epoch from pi.ended_at - pi.started_at))::bigint), 0)::bigint as count
    from public.playing_intervals pi
    join public.matches ma on ma.id = pi.match_id
    cross join bounds b
    where ma.started_at >= b.from_at
      and ma.started_at < b.to_at
      and pi.ended_at is not null
    group by pi.member_id
  ),
  member_totals as (
    select
      m.id as member_id,
      m.name,
      coalesce(g.count, 0)::bigint as total_goals,
      coalesce(p.count, 0)::bigint as participated_events,
      et.count::bigint as total_events,
      coalesce(s.count, 0)::bigint as total_seconds,
      m.created_at
    from public.members m
    cross join event_total et
    left join goals_by_member g on g.member_id = m.id
    left join participation_by_member p on p.member_id = m.id
    left join seconds_by_member s on s.member_id = m.id
  )
  select
    mt.member_id,
    mt.name,
    mt.total_goals,
    mt.participated_events,
    mt.total_events,
    mt.total_seconds,
    rank() over (order by mt.total_goals desc)::bigint as rank
  from member_totals mt
  order by mt.total_goals desc, mt.created_at asc, mt.member_id asc;
end;
$$;

comment on function public.get_public_rankings(date, date) is
  'Returns one aggregate ranking row per member for an inclusive JST calendar-date range.';

revoke all on function public.get_public_rankings(date, date) from public;
grant execute on function public.get_public_rankings(date, date)
  to anon, authenticated, service_role;

commit;
