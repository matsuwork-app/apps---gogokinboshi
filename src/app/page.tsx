import { createClient } from "@/lib/supabase/server";
import RankingTable from "@/components/RankingTable";
import PeriodFilter from "@/components/PeriodFilter";
import RankingModal from "@/components/RankingModal";
import type { RankingRow } from "@/types";

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear() - 1, now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const fromDate = params.from ?? defaultFrom;
  const toDate = params.to ?? defaultTo;

  const { data: members } = await supabase
    .from("members")
    .select("id, name")
    .order("created_at");

  if (!members || members.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">得点ランキング</h1>
        <p className="text-muted-foreground text-center py-12">
          メンバーが登録されていません。
          <br />
          まず「メンバー」ページからメンバーを追加してください。
        </p>
      </div>
    );
  }

  const [
    { data: goalRows },
    { data: intervalRows },
    { data: eventRows },
    { data: participationRows },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("member_id, matches!inner(started_at)")
      .gte("matches.started_at", `${fromDate}T00:00:00`)
      .lte("matches.started_at", `${toDate}T23:59:59`),
    supabase
      .from("playing_intervals")
      .select("member_id, started_at, ended_at, matches!inner(started_at)")
      .gte("matches.started_at", `${fromDate}T00:00:00`)
      .lte("matches.started_at", `${toDate}T23:59:59`)
      .not("ended_at", "is", null),
    supabase
      .from("events")
      .select("id")
      .gte("event_date", fromDate)
      .lte("event_date", toDate),
    supabase
      .from("event_participants")
      .select("member_id, events!inner(event_date)")
      .gte("events.event_date", fromDate)
      .lte("events.event_date", toDate),
  ]);

  const totalEvents = eventRows?.length ?? 0;

  const goalMap = new Map<string, number>();
  (goalRows ?? []).forEach(({ member_id }) => {
    goalMap.set(member_id, (goalMap.get(member_id) ?? 0) + 1);
  });

  const secondsMap = new Map<string, number>();
  (intervalRows ?? []).forEach(({ member_id, started_at, ended_at }) => {
    if (!ended_at) return;
    const sec = Math.floor(
      (new Date(ended_at).getTime() - new Date(started_at).getTime()) / 1000
    );
    secondsMap.set(member_id, (secondsMap.get(member_id) ?? 0) + sec);
  });

  const participationMap = new Map<string, number>();
  (participationRows ?? []).forEach(({ member_id }) => {
    participationMap.set(member_id, (participationMap.get(member_id) ?? 0) + 1);
  });

  const sorted = [...members]
    .map((m) => ({
      member_id: m.id,
      name: m.name,
      total_goals: goalMap.get(m.id) ?? 0,
      participated_events: participationMap.get(m.id) ?? 0,
      total_events: totalEvents,
      total_seconds: secondsMap.get(m.id) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.total_goals - a.total_goals);

  let rank = 1;
  sorted.forEach((row, i) => {
    if (i > 0 && row.total_goals < sorted[i - 1].total_goals) rank = i + 1;
    row.rank = rank;
  });

  const ranking: RankingRow[] = sorted;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">得点ランキング</h1>
        <RankingModal />
      </div>
      <PeriodFilter from={fromDate} to={toDate} />
      <RankingTable ranking={ranking} formatSeconds={formatSeconds} />
    </div>
  );
}
