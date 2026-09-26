import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, Clock, Pause, Play, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNextRecommendedPair, getRestingTeamIds, type MatchPair } from "@/lib/teams/rotation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  pending: { label: "未開始", icon: Clock, color: "secondary" },
  active: { label: "進行中", icon: Play, color: "default" },
  paused: { label: "一時停止中", icon: Pause, color: "secondary" },
  finished: { label: "終了", icon: CheckCircle, color: "outline" },
} as const;

type Team = {
  id: string;
  team_code: string;
  display_name: string;
  sort_order: number;
};

type MatchTeam = { id: string; event_team_id: string; side: number };
type MatchRow = {
  id: string;
  match_number: number;
  status: keyof typeof STATUS_LABEL;
  started_at: string | null;
  ended_at: string | null;
  match_teams: MatchTeam[] | MatchTeam | null;
};

const TEAM_BADGE: Record<string, string> = {
  A: "bg-blue-500 text-white",
  B: "bg-green-500 text-white",
  C: "bg-amber-500 text-white",
  D: "bg-rose-500 text-white",
};

function normalizeMatchTeams(value: MatchRow["match_teams"]) {
  return (Array.isArray(value) ? value : value ? [value] : []).sort(
    (first, second) => first.side - second.side
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (!event) notFound();

  const [matchesResult, teamsResult, participantsResult, goalsResult] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id,match_number,status,started_at,ended_at,match_teams(id,event_team_id,side)")
        .eq("event_id", id)
        .order("match_number"),
      supabase
        .from("event_teams")
        .select("id,team_code,display_name,sort_order")
        .eq("event_id", id)
        .order("sort_order"),
      supabase
        .from("event_participants")
        .select("members(id,name)")
        .eq("event_id", id),
      supabase
        .from("goals")
        .select("member_id,match_id,matches!inner(event_id)")
        .eq("matches.event_id", id),
    ]);

  const matches = (matchesResult.data ?? []) as unknown as MatchRow[];
  const teams = (teamsResult.data ?? []) as Team[];
  const goals = goalsResult.data ?? [];
  const memberList =
    participantsResult.data?.flatMap((participant) =>
      participant.members ? [participant.members] : []
    ) ?? [];

  const matchIds = matches.map((match) => match.id);
  const { data: matchLineups } = matchIds.length
    ? await supabase
        .from("match_lineups")
        .select("match_id,member_id,team")
        .in("match_id", matchIds)
    : { data: [] };

  const goalSummary = new Map<string, number>();
  goals.forEach(({ member_id }) => {
    goalSummary.set(member_id, (goalSummary.get(member_id) ?? 0) + 1);
  });

  const lineupByMatch = new Map<string, Map<string, "A" | "B">>();
  (matchLineups ?? []).forEach(({ match_id, member_id, team }) => {
    if (!lineupByMatch.has(match_id)) lineupByMatch.set(match_id, new Map());
    lineupByMatch.get(match_id)!.set(member_id, team as "A" | "B");
  });

  const matchGoals = new Map<string, { A: number; B: number }>();
  goals.forEach(({ member_id, match_id }) => {
    const side = lineupByMatch.get(match_id)?.get(member_id);
    if (!side) return;
    if (!matchGoals.has(match_id)) matchGoals.set(match_id, { A: 0, B: 0 });
    matchGoals.get(match_id)![side] += 1;
  });

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const history: MatchPair[] = matches.flatMap((match) => {
    const ids = normalizeMatchTeams(match.match_teams).map((team) => team.event_team_id);
    return ids.length === 2 ? [[ids[0], ids[1]] as MatchPair] : [];
  });
  const nextPair = teams.length >= 2
    ? getNextRecommendedPair(teams.map((team) => team.id), history)
    : null;
  const restingTeams = nextPair
    ? getRestingTeamIds(teams.map((team) => team.id), nextPair)
        .map((teamId) => teamById.get(teamId))
        .filter((team): team is Team => Boolean(team))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {new Date(event.event_date).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
            timeZone: "Asia/Tokyo",
          })}
        </h1>
        {event.notes && <p className="mt-1 text-muted-foreground">{event.notes}</p>}
        <p className="mt-1 text-sm text-muted-foreground">
          参加: {memberList.map((member) => member.name).join("、")}
        </p>
      </div>

      {nextPair && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">次のおすすめ対戦</p>
              <p className="mt-1 text-lg font-bold">
                {teamById.get(nextPair[0])?.display_name} vs {teamById.get(nextPair[1])?.display_name}
              </p>
            </div>
            <Link href={`/events/${id}/matches/new`} className={cn(buttonVariants({ size: "sm" }))}>
              この対戦を作成
            </Link>
          </div>
          {restingTeams.length > 0 && (
            <p className="text-sm text-muted-foreground">
              休憩: {restingTeams.map((team) => team.display_name).join("、")}
            </p>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">試合</h2>
          <Link href={`/events/${id}/matches/new`} className={cn(buttonVariants({ size: "sm" }))}>
            <Plus size={14} className="mr-1" />
            試合を追加
          </Link>
        </div>

        {matches.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            試合がありません。「試合を追加」から始めましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {matches.map((match) => {
              const status = STATUS_LABEL[match.status];
              const score = matchGoals.get(match.id) ?? { A: 0, B: 0 };
              const pair = normalizeMatchTeams(match.match_teams);
              const first = teamById.get(pair[0]?.event_team_id);
              const second = teamById.get(pair[1]?.event_team_id);
              return (
                <li key={match.id}>
                  <Link
                    href={`/events/${id}/matches/${match.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">第{match.match_number}試合</span>
                        <Badge variant={status.color as "default" | "secondary" | "outline"}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {first?.display_name ?? "チームA"} vs {second?.display_name ?? "チームB"}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-bold">
                      {score.A} - {score.B}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {teams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">チーム</h2>
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center gap-2 rounded-lg border bg-card p-3">
                <Badge className={TEAM_BADGE[team.team_code] ?? ""}>{team.team_code}</Badge>
                <span className="truncate text-sm font-medium">{team.display_name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {memberList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">当日得点まとめ</h2>
          <ul className="grid grid-cols-2 gap-2">
            {memberList
              .map((member) => ({ ...member, goals: goalSummary.get(member.id) ?? 0 }))
              .sort((first, second) => second.goals - first.goals)
              .map((member) => (
                <li key={member.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <span className="text-sm font-medium">{member.name}</span>
                  <span className="text-lg font-bold">{member.goals}点</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
