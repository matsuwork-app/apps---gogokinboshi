import { notFound } from "next/navigation";

import TurnScoringClient from "@/components/turns/TurnScoringClient";
import { createClient } from "@/lib/supabase/server";
import { buildTurnTeams } from "@/lib/turns/build-teams";
import { asTurnScoringClient } from "@/lib/turns/database";

export default async function EventTurnPage({
  params,
}: {
  params: Promise<{ id: string; turnId: string }>;
}) {
  const { id: eventId, turnId } = await params;
  const supabase = asTurnScoringClient(await createClient());

  const { data: turn, error: turnError } = await supabase
    .from("event_turns")
    .select("id,event_id,turn_number")
    .eq("id", turnId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (turnError) {
    throw new Error("ターンの読み込みに失敗しました", { cause: turnError });
  }
  if (!turn) notFound();

  const [
    { data: eventTeams, error: eventTeamsError },
    { data: memberships, error: membershipsError },
    { data: eventMatches, error: eventMatchesError },
    { data: eventTurns, error: eventTurnsError },
  ] = await Promise.all([
    supabase
      .from("event_teams")
      .select("id,team_code,display_name,sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("turn_team_members")
      .select("event_team_id,member_id")
      .eq("event_turn_id", turnId),
    supabase.from("matches").select("id").eq("event_id", eventId),
    supabase.from("event_turns").select("id").eq("event_id", eventId),
  ]);

  const firstLoadError =
    eventTeamsError ?? membershipsError ?? eventMatchesError ?? eventTurnsError;
  if (firstLoadError) {
    throw new Error("ターンの参加者情報を読み込めませんでした", {
      cause: firstLoadError,
    });
  }

  const memberIds = [...new Set((memberships ?? []).map((row) => row.member_id))];
  const matchIds = (eventMatches ?? []).map((row) => row.id);
  const turnIds = (eventTurns ?? []).map((row) => row.id);

  const [membersResult, legacyGoalsResult, turnGoalsResult] = await Promise.all([
    memberIds.length > 0
      ? supabase.from("members").select("id,name").in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length > 0
      ? supabase.from("goals").select("member_id").in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    turnIds.length > 0
      ? supabase
          .from("goals")
          .select("id,member_id,event_turn_id")
          .in("event_turn_id", turnIds)
          .order("scored_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const secondLoadError =
    membersResult.error ?? legacyGoalsResult.error ?? turnGoalsResult.error;
  if (secondLoadError) {
    throw new Error("ターンの得点情報を読み込めませんでした", {
      cause: secondLoadError,
    });
  }

  const teams = buildTurnTeams({
    currentTurnId: turnId,
    eventTeams: eventTeams ?? [],
    memberships: memberships ?? [],
    members: membersResult.data ?? [],
    legacyGoals: legacyGoalsResult.data ?? [],
    turnGoals: turnGoalsResult.data ?? [],
  });

  return (
    <TurnScoringClient
      eventId={eventId}
      turnId={turnId}
      turnNumber={turn.turn_number}
      initialTeams={teams}
    />
  );
}
