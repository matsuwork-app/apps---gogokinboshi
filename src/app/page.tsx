import RankingTable from "@/components/RankingTable";
import PeriodFilter from "@/components/PeriodFilter";
import RankingModal from "@/components/RankingModal";
import { getDefaultDashboardPeriod } from "@/lib/rankings/date-range";
import { getPublicRankings } from "@/lib/rankings/server";

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const defaults = getDefaultDashboardPeriod();
  const fromDate = typeof params.from === "string" ? params.from : defaults.from;
  const toDate = typeof params.to === "string" ? params.to : defaults.to;

  let ranking;
  try {
    ranking = await getPublicRankings(fromDate, toDate);
  } catch (error) {
    console.error("Failed to render public rankings", error);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">得点ランキング</h1>
          <RankingModal />
        </div>
        <PeriodFilter from={fromDate} to={toDate} />
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          ランキングの取得に失敗しました。期間を確認するか、時間をおいてもう一度お試しください。
        </div>
      </div>
    );
  }

  if (ranking.length === 0) {
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
