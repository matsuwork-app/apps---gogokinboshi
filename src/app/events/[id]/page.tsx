import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, CheckCircle, Clock } from "lucide-react";

const STATUS_LABEL = {
  pending: { label: "未開始", icon: Clock, color: "secondary" },
  active: { label: "進行中", icon: Play, color: "default" },
  finished: { label: "終了", icon: CheckCircle, color: "outline" },
} as const;

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

  const { data: matches } = await supabase
    .from("matches")
    .select("id, match_number, status, started_at, ended_at")
    .eq("event_id", id)
    .order("match_number");

  const { data: participants } = await supabase
    .from("event_participants")
    .select("members(id, name)")
    .eq("event_id", id);

  const { data: goals } = await supabase
    .from("goals")
    .select("member_id, match_id, matches!inner(event_id)")
    .eq("matches.event_id", id);

  const goalSummary = new Map<string, number>();
  (goals ?? []).forEach(({ member_id }) => {
    goalSummary.set(member_id, (goalSummary.get(member_id) ?? 0) + 1);
  });

  const matchGoals = new Map<string, { A: number; B: number }>();
  const { data: matchLineups } = await supabase
    .from("match_lineups")
    .select("match_id, member_id, team")
    .in("match_id", (matches ?? []).map((m) => m.id));

  const lineupByMatch = new Map<string, Map<string, "A" | "B">>();
  (matchLineups ?? []).forEach(({ match_id, member_id, team }) => {
    if (!lineupByMatch.has(match_id))
      lineupByMatch.set(match_id, new Map());
    lineupByMatch.get(match_id)!.set(member_id, team as "A" | "B");
  });

  (goals ?? []).forEach(({ member_id, match_id }) => {
    const team = lineupByMatch.get(match_id)?.get(member_id);
    if (!team) return;
    if (!matchGoals.has(match_id)) matchGoals.set(match_id, { A: 0, B: 0 });
    matchGoals.get(match_id)![team]++;
  });

  const memberList =
    participants?.flatMap((p) => (p.members ? [p.members] : [])) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {new Date(event.event_date).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </h1>
        {event.notes && (
          <p className="text-muted-foreground mt-1">{event.notes}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          参加: {memberList.map((m) => m.name).join("、")}
        </p>
      </div>

      {/* 試合一覧 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">試合</h2>
          <Link href={`/events/${id}/matches/new`} className={cn(buttonVariants({ size: "sm" }))}>
            <Plus size={14} className="mr-1" />
            試合を追加
          </Link>
        </div>

        {(!matches || matches.length === 0) ? (
          <p className="text-muted-foreground text-center py-6 text-sm">
            試合がありません。「試合を追加」から始めましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {matches.map((match) => {
              const s = STATUS_LABEL[match.status];
              const score = matchGoals.get(match.id) ?? { A: 0, B: 0 };
              return (
                <li key={match.id}>
                  <Link
                    href={`/events/${id}/matches/${match.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        第{match.match_number}試合
                      </span>
                      <Badge variant={s.color as "default" | "secondary" | "outline"}>
                        {s.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        A {score.A} - {score.B} B
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 当日の個人得点サマリー */}
      {memberList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">当日得点まとめ</h2>
          <ul className="grid grid-cols-2 gap-2">
            {memberList
              .map((m) => ({ ...m, goals: goalSummary.get(m.id) ?? 0 }))
              .sort((a, b) => b.goals - a.goals)
              .map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <span className="font-medium text-sm">{m.name}</span>
                  <span className="font-bold text-lg">{m.goals}点</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
