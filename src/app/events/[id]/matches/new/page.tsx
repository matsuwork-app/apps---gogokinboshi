import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Member } from "@/types";
import type { MatchPair } from "@/lib/teams/rotation";
import { hasManagerSession } from "@/lib/auth";
import MatchNewForm, { type EventTeamForMatch } from "./MatchNewForm";

type EventTeamRow = {
  id: string;
  event_id: string;
  team_code: string;
  display_name: string;
  sort_order: number;
};

type EventTeamMemberRow = {
  event_team_id: string;
  members: Member | Member[] | null;
};

type MatchRow = {
  match_teams:
    | { event_team_id: string; side: number }[]
    | { event_team_id: string; side: number }
    | null;
};

function normalizeMember(value: Member | Member[] | null): Member | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function MatchNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const initialCanManage = await hasManagerSession();

  const { data: event } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", eventId)
    .single();
  if (!event) notFound();

  const [{ data: teamData }, { data: teamMemberData }, { data: matchData }] =
    await Promise.all([
      supabase
        .from("event_teams")
        .select("id,event_id,team_code,display_name,sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("event_team_members")
        .select("event_team_id,members(*)")
        .eq("event_id", eventId),
      supabase
        .from("matches")
        .select("match_teams(event_team_id,side)")
        .eq("event_id", eventId)
        .order("match_number", { ascending: true }),
    ]);

  const teamRows = (teamData ?? []) as unknown as EventTeamRow[];
  const teamMemberRows = (teamMemberData ?? []) as unknown as EventTeamMemberRow[];
  const matchRows = (matchData ?? []) as unknown as MatchRow[];

  if (teamRows.length < 2 || teamRows.length > 4) notFound();

  const teams: EventTeamForMatch[] = teamRows.map((team) => ({
    ...team,
    members: teamMemberRows
      .filter((row) => row.event_team_id === team.id)
      .map((row) => normalizeMember(row.members))
      .filter((member): member is Member => member !== null),
  }));

  const teamIdSet = new Set(teams.map((team) => team.id));
  const matchHistory: MatchPair[] = matchRows.flatMap((match) => {
    const matchTeams = Array.isArray(match.match_teams)
      ? match.match_teams
      : match.match_teams
        ? [match.match_teams]
        : [];
    const orderedTeamIds = [...matchTeams]
      .sort((first, second) => first.side - second.side)
      .map((team) => team.event_team_id);

    return orderedTeamIds.length === 2 &&
      orderedTeamIds[0] !== orderedTeamIds[1] &&
      orderedTeamIds.every((teamId) => teamIdSet.has(teamId))
      ? [[orderedTeamIds[0], orderedTeamIds[1]] as MatchPair]
      : [];
  });

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">対戦チームを選択</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          1試合で対戦する2チームを選んでください。残りのチームは休憩です。
        </p>
      </div>
      <MatchNewForm
        teams={teams}
        eventId={eventId}
        matchHistory={matchHistory}
        initialCanManage={initialCanManage}
      />
    </div>
  );
}
