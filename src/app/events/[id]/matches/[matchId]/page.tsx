import { notFound } from "next/navigation";

import { hasManagerSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EventTeam, Member } from "@/types";

import MatchClient, {
  type MatchPlayer,
  type MatchTeamDisplay,
} from "./MatchClient";

type LineupRow = {
  member_id: string;
  match_team_id: string;
  is_playing: boolean;
  members: Member | Member[] | null;
};

type MatchTeamRow = {
  id: string;
  event_team_id: string;
  side: number;
  team: EventTeam | EventTeam[] | null;
};

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id: eventId, matchId } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("event_id", eventId)
    .single();
  if (!match) notFound();

  const [
    { data: lineupData, error: lineupError },
    { data: goals, error: goalsError },
    { data: matchTeamData, error: matchTeamError },
    { data: eventTeamData, error: eventTeamError },
    canManage,
  ] = await Promise.all([
    supabase
      .from("match_lineups")
      .select("member_id,match_team_id,is_playing,members(*)")
      .eq("match_id", matchId),
    supabase
      .from("goals")
      .select("id,member_id")
      .eq("match_id", matchId)
      .order("scored_at"),
    supabase
      .from("match_teams")
      .select(
        "id,event_team_id,side,team:event_teams!match_teams_event_team_fkey(id,event_id,team_code,display_name,sort_order,created_at)"
      )
      .eq("match_id", matchId)
      .order("side", { ascending: true }),
    supabase
      .from("event_teams")
      .select("id,event_id,team_code,display_name,sort_order,created_at")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
    hasManagerSession(),
  ]);

  const loadError =
    lineupError ?? goalsError ?? matchTeamError ?? eventTeamError;
  if (loadError) {
    throw new Error(`試合データの読み込みに失敗しました: ${loadError.message}`);
  }

  const matchTeamRows = (matchTeamData ?? []) as unknown as MatchTeamRow[];
  const matchTeams: MatchTeamDisplay[] = matchTeamRows.flatMap((row) => {
    const team = normalizeOne(row.team);
    if (!team || (row.side !== 1 && row.side !== 2)) return [];

    return [
      {
        matchTeamId: row.id,
        eventTeamId: row.event_team_id,
        side: row.side,
        teamCode: team.team_code,
        displayName: team.display_name,
      },
    ];
  });

  if (matchTeams.length !== 2) {
    throw new Error("この試合の対戦チームを2チーム特定できませんでした");
  }

  const teamSideByMatchTeamId = new Map(
    matchTeams.map((team) => [team.matchTeamId, team.side] as const)
  );
  const lineupRows = (lineupData ?? []) as unknown as LineupRow[];
  const players: MatchPlayer[] = lineupRows.flatMap((lineup) => {
    const member = normalizeOne(lineup.members);
    const side = teamSideByMatchTeamId.get(lineup.match_team_id);
    if (!member || (side !== 1 && side !== 2)) return [];

    return [
      {
        member,
        side,
        goals: (goals ?? []).filter(
          (goal) => goal.member_id === lineup.member_id
        ).length,
        isPlaying: lineup.is_playing,
      },
    ];
  });

  const goalIds = (goals ?? []).reduce<Record<string, string[]>>(
    (idsByMember, goal) => {
      (idsByMember[goal.member_id] ??= []).push(goal.id);
      return idsByMember;
    },
    {}
  );
  const playingTeamIds = new Set(
    matchTeams.map((team) => team.eventTeamId)
  );
  const restingTeams = ((eventTeamData ?? []) as EventTeam[])
    .filter((team) => !playingTeamIds.has(team.id))
    .map((team) => ({
      teamCode: team.team_code,
      displayName: team.display_name,
    }));

  return (
    <MatchClient
      match={match}
      initialPlayers={players}
      initialGoalIds={goalIds}
      eventId={eventId}
      teams={matchTeams}
      restingTeams={restingTeams}
      initialCanManage={canManage}
    />
  );
}
