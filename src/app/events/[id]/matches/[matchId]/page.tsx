import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MatchClient from "./MatchClient";

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
    .single();
  if (!match) notFound();

  const { data: lineups } = await supabase
    .from("match_lineups")
    .select("member_id, team, members(id, name)")
    .eq("match_id", matchId);

  const { data: goals } = await supabase
    .from("goals")
    .select("id, member_id")
    .eq("match_id", matchId)
    .order("scored_at");

  const { data: openIntervals } = await supabase
    .from("playing_intervals")
    .select("id, member_id")
    .eq("match_id", matchId)
    .is("ended_at", null);

  const players = (lineups ?? []).map((l) => {
    const member = Array.isArray(l.members) ? l.members[0] : l.members;
    const openInterval = openIntervals?.find((i) => i.member_id === l.member_id);
    return {
      member: member!,
      team: l.team as "A" | "B",
      goals: (goals ?? []).filter((g) => g.member_id === l.member_id).length,
      isPlaying: match.status === "pending" ? true : !!openInterval,
      openIntervalId: openInterval?.id ?? null,
    };
  });

  const goalIds = (goals ?? []).reduce(
    (acc, g) => {
      if (!acc[g.member_id]) acc[g.member_id] = [];
      acc[g.member_id].push(g.id);
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <MatchClient
      match={match}
      initialPlayers={players}
      initialGoalIds={goalIds}
      eventId={eventId}
    />
  );
}
