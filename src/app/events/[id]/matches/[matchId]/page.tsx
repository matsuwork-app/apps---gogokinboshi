import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import LegacyMatchScoringClient, {
  type LegacyMatchTeam,
} from "@/components/turns/LegacyMatchScoringClient";
import { createClient } from "@/lib/supabase/server";
import { asTurnScoringClient } from "@/lib/turns/database";

type MemberRelation = { id: string; name: string };
type LineupRow = {
  member_id: string;
  match_team_id: string;
  members: MemberRelation | MemberRelation[] | null;
};
type MatchTeamRow = {
  id: string;
  side: number;
  team:
    | { team_code: string; display_name: string }
    | { team_code: string; display_name: string }[]
    | null;
};

function normalizeOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function LegacyMatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id: eventId, matchId } = await params;
  const supabase = asTurnScoringClient(await createClient());

  const [matchResult, lineupsResult, matchTeamsResult, matchGoalsResult, eventMatchesResult, eventTurnsResult] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id,event_id,match_number")
        .eq("id", matchId)
        .eq("event_id", eventId)
        .maybeSingle(),
      supabase
        .from("match_lineups")
        .select("member_id,match_team_id,members(id,name)")
        .eq("match_id", matchId),
      supabase
        .from("match_teams")
        .select("id,side,team:event_teams!match_teams_event_team_fkey(team_code,display_name)")
        .eq("match_id", matchId)
        .order("side"),
      supabase.from("goals").select("id,member_id").eq("match_id", matchId).order("scored_at"),
      supabase.from("matches").select("id").eq("event_id", eventId),
      supabase.from("event_turns").select("id").eq("event_id", eventId),
    ]);

  if (matchResult.error) {
    throw new Error("以前の試合記録を読み込めませんでした", { cause: matchResult.error });
  }
  if (!matchResult.data) notFound();
  const firstError = [
    lineupsResult.error,
    matchTeamsResult.error,
    matchGoalsResult.error,
    eventMatchesResult.error,
    eventTurnsResult.error,
  ].find(Boolean);
  if (firstError) throw new Error("以前の試合記録を読み込めませんでした", { cause: firstError });

  const matchIds = (eventMatchesResult.data ?? []).map(({ id }) => id);
  const turnIds = (eventTurnsResult.data ?? []).map(({ id }) => id);
  const [legacyDailyResult, turnDailyResult] = await Promise.all([
    matchIds.length
      ? supabase.from("goals").select("member_id").in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    turnIds.length
      ? supabase.from("goals").select("member_id").in("event_turn_id", turnIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const dailyError = legacyDailyResult.error ?? turnDailyResult.error;
  if (dailyError) throw new Error("本日累計を読み込めませんでした", { cause: dailyError });

  const matchGoals = new Map<string, number>();
  const goalIds = new Map<string, string[]>();
  (matchGoalsResult.data ?? []).forEach(({ id, member_id }) => {
    matchGoals.set(member_id, (matchGoals.get(member_id) ?? 0) + 1);
    goalIds.set(member_id, [...(goalIds.get(member_id) ?? []), id]);
  });
  const dailyGoals = new Map<string, number>();
  [...(legacyDailyResult.data ?? []), ...(turnDailyResult.data ?? [])].forEach(({ member_id }) => {
    dailyGoals.set(member_id, (dailyGoals.get(member_id) ?? 0) + 1);
  });

  const lineups = (lineupsResult.data ?? []) as unknown as LineupRow[];
  const matchTeams = (matchTeamsResult.data ?? []) as unknown as MatchTeamRow[];
  const teams: LegacyMatchTeam[] = matchTeams.map((matchTeam) => {
    const team = normalizeOne(matchTeam.team);
    const players = lineups.flatMap((lineup) => {
      if (lineup.match_team_id !== matchTeam.id) return [];
      const member = normalizeOne(lineup.members);
      return member
        ? [
            {
              id: member.id,
              name: member.name,
              matchGoals: matchGoals.get(member.id) ?? 0,
              dailyGoals: dailyGoals.get(member.id) ?? 0,
              goalIds: goalIds.get(member.id) ?? [],
            },
          ]
        : [];
    });
    return {
      id: matchTeam.id,
      teamCode: team?.team_code ?? (matchTeam.side === 1 ? "A" : "B"),
      displayName: team?.display_name ?? "チーム",
      players,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/events/${eventId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← イベント詳細へ戻る
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-2xl font-bold">第{matchResult.data.match_number}試合</h1>
          <Badge variant="outline">以前の記録</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          旧方式の履歴です。この試合の誤入力だけ、ここで追加・取り消しできます。
        </p>
      </header>
      <LegacyMatchScoringClient matchId={matchId} initialTeams={teams} />
    </div>
  );
}
