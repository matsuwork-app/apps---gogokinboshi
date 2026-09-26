-- Emergency compatibility rollback for the pre-multiteam deployment.
--
-- This intentionally keeps all migrated data and new schema objects. It only
-- restores the permission/constraint shape required by the previous browser-
-- direct Supabase client so the old Vercel deployment can write again.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

-- The legacy client does not populate these multiteam/state-machine columns.
alter table public.match_lineups
  alter column match_team_id drop not null;

alter table public.matches
  drop constraint if exists matches_status_timestamps_check;

-- Before this release, browser clients wrote directly with the anon key.
-- Disabling RLS plus restoring grants recreates that compatibility boundary.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'members', 'events', 'event_participants', 'matches',
    'match_lineups', 'goals', 'playing_intervals'
  ]
  loop
    execute format('alter table public.%I disable row level security', v_table);
    execute format('grant all on table public.%I to anon, authenticated', v_table);
  end loop;
end
$$;

commit;
