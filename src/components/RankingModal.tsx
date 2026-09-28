"use client";

import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadPublicRankings } from "@/app/actions/rankings";
import {
  formatJapaneseDate,
  getDefaultModalPeriod,
  isValidDateRange,
} from "@/lib/rankings/date-range";
import { BarChart3, ArrowRight, Loader2 } from "lucide-react";
import type { RankingRow } from "@/types";

const PODIUM = [
  { rank: 2, emoji: "🥈", bg: "from-slate-300 to-slate-400", height: "h-20", order: "order-1", label: "2位" },
  { rank: 1, emoji: "🥇", bg: "from-yellow-400 to-amber-500", height: "h-28", order: "order-2", label: "1位" },
  { rank: 3, emoji: "🥉", bg: "from-amber-600 to-amber-700", height: "h-14", order: "order-3", label: "3位" },
];

type Step = "select" | "loading" | "result";

export default function RankingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [fromDate, setFromDate] = useState(() => getDefaultModalPeriod().from);
  const [toDate, setToDate] = useState(() => getDefaultModalPeriod().to);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasDateError, setHasDateError] = useState(false);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setStep("select");
      setError(null);
      setHasDateError(false);
    }
  }

  async function handleGo() {
    if (!isValidDateRange(fromDate, toDate)) {
      setError("期間を正しく指定してください");
      setHasDateError(true);
      return;
    }
    setError(null);
    setHasDateError(false);
    setStep("loading");

    try {
      const result = await loadPublicRankings(fromDate, toDate);
      if (!result.ok) {
        setError(result.error);
        setHasDateError(false);
        setStep("select");
        return;
      }

      setPeriodLabel(`${formatJapaneseDate(fromDate)} 〜 ${formatJapaneseDate(toDate)}`);
      setRanking(result.ranking);
      setStep("result");
    } catch {
      setError("ランキングの取得に失敗しました。時間をおいてもう一度お試しください。");
      setHasDateError(false);
      setStep("select");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <BarChart3 size={15} aria-hidden="true" />
        集計
      </DialogTrigger>

      <DialogContent
        className="max-w-sm w-full p-0 overflow-hidden rounded-2xl border-0 shadow-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">得点王を決める</DialogTitle>
        <DialogDescription className="sr-only">
          集計期間を指定して得点ランキングを表示します。
        </DialogDescription>

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
                <DialogClose
                  aria-label="集計画面を閉じる"
                  className="text-white/60 hover:text-white text-xl leading-none mt-0.5 px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span aria-hidden="true">✕</span>
                </DialogClose>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ranking-from-date" className="text-sm font-semibold">開始日</Label>
                <Input
                  id="ranking-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setError(null);
                    setHasDateError(false);
                  }}
                  disabled={step === "loading"}
                  aria-invalid={hasDateError}
                  aria-describedby={hasDateError ? "ranking-period-error" : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ranking-to-date" className="text-sm font-semibold">終了日</Label>
                <Input
                  id="ranking-to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setError(null);
                    setHasDateError(false);
                  }}
                  disabled={step === "loading"}
                  aria-invalid={hasDateError}
                  aria-describedby={hasDateError ? "ranking-period-error" : undefined}
                />
              </div>
              {error && (
                <p id="ranking-period-error" role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
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
                  <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> <span role="status">集計中...</span></>
                ) : (
                  <>GO <ArrowRight size={15} aria-hidden="true" /></>
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
                <DialogClose
                  aria-label="集計画面を閉じる"
                  className="text-white/60 hover:text-white text-xl leading-none mt-0.5 px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span aria-hidden="true">✕</span>
                </DialogClose>
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
