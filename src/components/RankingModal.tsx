"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, ArrowRight, Loader2 } from "lucide-react";
import type { RankingRow } from "@/types";

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分`;
  return "-";
}

const PODIUM = [
  { rank: 2, emoji: "🥈", bg: "from-slate-300 to-slate-400", height: "h-20", order: "order-1", label: "2位" },
  { rank: 1, emoji: "🥇", bg: "from-yellow-400 to-amber-500", height: "h-28", order: "order-2", label: "1位" },
  { rank: 3, emoji: "🥉", bg: "from-amber-600 to-amber-700", height: "h-14", order: "order-3", label: "3位" },
];

type Step = "select" | "loading" | "result";

export default function RankingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setStep("select");
  }

  async function handleGo() {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError("期間を正しく指定してください");
      return;
    }
    setError(null);
    setStep("loading");

    const supabase = createClient();

    const [{ data: members }, { data: goalRows }, { data: intervalRows }, { data: eventRows }, { data: participationRows }] =
      await Promise.all([
        supabase.from("members").select("id, name").order("created_at"),
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

    const sorted = (members ?? [])
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

    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
    setPeriodLabel(`${fmt(fromDate)} 〜 ${fmt(toDate)}`);
    setRanking(sorted);
    setStep("result");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <BarChart3 size={15} />
        集計
      </DialogTrigger>

      <DialogContent
        className="max-w-sm w-full p-0 overflow-hidden rounded-2xl border-0 shadow-2xl"
        showCloseButton={false}
      >
        {/* ---- STEP: 期間選択 ---- */}
        {(step === "select" || step === "loading") && (
          <>
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-5 pt-5 pb-4 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-white/70 uppercase tracking-wider">
                    集計期間を選択
                  </p>
                  <p className="font-bold text-xl mt-0.5">🏆 得点王を決める</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/60 hover:text-white text-xl leading-none mt-0.5 px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">開始日</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={step === "loading"}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">終了日</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={step === "loading"}
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={step === "loading"}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1 gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
                onClick={handleGo}
                disabled={step === "loading"}
              >
                {step === "loading" ? (
                  <><Loader2 size={15} className="animate-spin" /> 集計中...</>
                ) : (
                  <>GO <ArrowRight size={15} /></>
                )}
              </Button>
            </div>
          </>
        )}

        {/* ---- STEP: ランキング結果 ---- */}
        {step === "result" && (
          <>
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-5 pt-5 pb-4 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-white/70 uppercase tracking-wider mb-0.5">
                    集計期間
                  </p>
                  <p className="font-bold text-base leading-snug">{periodLabel}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/60 hover:text-white text-xl leading-none mt-0.5 px-1"
                >
                  ✕
                </button>
              </div>
              <p className="text-3xl mt-2">🏆 得点王</p>
            </div>

            {/* 表彰台 */}
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 px-4 pt-4 pb-6">
              <div className="flex items-end justify-center gap-2">
                {PODIUM.map((cfg) => {
                  const player = ranking.find((r) => r.rank === cfg.rank);
                  return (
                    <div key={cfg.rank} className={`flex flex-col items-center gap-1.5 ${cfg.order}`}>
                      {player ? (
                        <>
                          <p className="text-white text-xs font-bold text-center leading-tight max-w-[72px] truncate">
                            {player.name}
                          </p>
                          <p className="text-white font-black text-xl">
                            {player.total_goals}
                            <span className="text-xs font-normal ml-0.5">点</span>
                          </p>
                        </>
                      ) : (
                        <p className="text-white/30 text-xs pb-6">-</p>
                      )}
                      <div
                        className={`w-20 ${cfg.height} rounded-t-lg bg-gradient-to-b ${cfg.bg} flex items-start justify-center pt-2`}
                      >
                        <span className="text-2xl">{cfg.emoji}</span>
                      </div>
                      <p className="text-white/60 text-xs">{cfg.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 全ランキング */}
            <div className="bg-background max-h-56 overflow-y-auto">
              {ranking.map((row) => (
                <div
                  key={row.member_id}
                  className={`flex items-center px-4 py-2.5 border-b last:border-0 ${
                    row.rank <= 3 ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                  }`}
                >
                  <span className="w-8 text-center font-bold text-sm text-muted-foreground">
                    {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
                  </span>
                  <span className="flex-1 font-semibold text-sm">{row.name}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold text-base">{row.total_goals}<span className="text-muted-foreground text-xs ml-0.5 font-normal">点</span></span>
                    <span className="text-muted-foreground text-xs w-12 text-right">
                      {row.total_events > 0 ? `${Math.round((row.participated_events / row.total_events) * 100)}%` : "-"}
                    </span>
                    <span className="text-muted-foreground text-xs w-14 text-right">{formatSeconds(row.total_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 bg-muted/40 border-t flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("select")} className="flex-1">
                ← 期間を変更
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="flex-1">
                閉じる
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
