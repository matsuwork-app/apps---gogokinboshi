"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match, PlayerState } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Play, Square, Pause, RotateCcw, Plus, Minus } from "lucide-react";

type Props = {
  match: Match;
  initialPlayers: PlayerState[];
  initialGoalIds: Record<string, string[]>;
  eventId: string;
};

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MatchClient({
  match,
  initialPlayers,
  initialGoalIds,
  eventId,
}: Props) {
  const supabase = createClient();
  const [players, setPlayers] = useState<PlayerState[]>(initialPlayers);
  const [goalIds, setGoalIds] =
    useState<Record<string, string[]>>(initialGoalIds);
  const [status, setStatus] = useState<Match["status"]>(match.status);
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "active" && match.started_at) {
      const base = Math.floor(
        (Date.now() - new Date(match.started_at).getTime()) / 1000
      );
      setElapsed(base);
      startTimeRef.current = Date.now() - base * 1000;
      timerRef.current = setInterval(() => {
        setElapsed(
          Math.floor((Date.now() - startTimeRef.current!) / 1000)
        );
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const scoreA = players
    .filter((p) => p.team === "A")
    .reduce((s, p) => s + p.goals, 0);
  const scoreB = players
    .filter((p) => p.team === "B")
    .reduce((s, p) => s + p.goals, 0);

  // --- キックオフ ---
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    const now = new Date().toISOString();

    const { error: matchError } = await supabase
      .from("matches")
      .update({ status: "active", started_at: now })
      .eq("id", match.id);
    if (matchError) { toast.error(matchError.message); setIsLoading(false); return; }

    const playingPlayers = players.filter((p) => p.isPlaying);
    if (playingPlayers.length > 0) {
      const { data: intervals, error: intError } = await supabase
        .from("playing_intervals")
        .insert(
          playingPlayers.map((p) => ({ match_id: match.id, member_id: p.member.id, started_at: now }))
        )
        .select("id, member_id");
      if (intError) { toast.error(intError.message); setIsLoading(false); return; }

      setPlayers((prev) =>
        prev.map((p) => {
          const interval = intervals?.find((i) => i.member_id === p.member.id);
          return interval ? { ...p, openIntervalId: interval.id } : p;
        })
      );
    }

    setStatus("active");
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
    }, 1000);
    setIsLoading(false);
  }, [match.id, players, supabase]);

  // --- 一時停止 ---
  const handlePause = useCallback(async () => {
    setIsLoading(true);
    const now = new Date().toISOString();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const { error: matchError } = await supabase
      .from("matches")
      .update({ status: "paused" })
      .eq("id", match.id);
    if (matchError) { toast.error(matchError.message); setIsLoading(false); return; }

    // 全オープンインターバルをクローズ
    const openIds = players.map((p) => p.openIntervalId).filter(Boolean) as string[];
    if (openIds.length > 0) {
      await supabase
        .from("playing_intervals")
        .update({ ended_at: now })
        .in("id", openIds);
    }

    setStatus("paused");
    setPlayers((prev) => prev.map((p) => ({ ...p, openIntervalId: null })));
    setIsLoading(false);
  }, [match.id, players, supabase]);

  // --- 再開 ---
  const handleResume = useCallback(async () => {
    setIsLoading(true);
    const now = new Date().toISOString();

    const { error: matchError } = await supabase
      .from("matches")
      .update({ status: "active" })
      .eq("id", match.id);
    if (matchError) { toast.error(matchError.message); setIsLoading(false); return; }

    // 出場中メンバーのインターバルを再開
    const playingPlayers = players.filter((p) => p.isPlaying);
    let updatedPlayers = players;
    if (playingPlayers.length > 0) {
      const { data: intervals, error: intError } = await supabase
        .from("playing_intervals")
        .insert(
          playingPlayers.map((p) => ({ match_id: match.id, member_id: p.member.id, started_at: now }))
        )
        .select("id, member_id");
      if (intError) { toast.error(intError.message); setIsLoading(false); return; }

      updatedPlayers = players.map((p) => {
        const interval = intervals?.find((i) => i.member_id === p.member.id);
        return interval ? { ...p, openIntervalId: interval.id } : p;
      });
      setPlayers(updatedPlayers);
    }

    setStatus("active");
    // elapsed は一時停止時点の値を維持したまま再開
    startTimeRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
    }, 1000);
    setIsLoading(false);
  }, [match.id, players, elapsed, supabase]);

  // --- 試合終了 ---
  const handleStop = useCallback(async () => {
    if (!confirm("試合を終了しますか？")) return;
    setIsLoading(true);
    const now = new Date().toISOString();

    if (timerRef.current) clearInterval(timerRef.current);

    const { error: matchError } = await supabase
      .from("matches")
      .update({ status: "finished", ended_at: now })
      .eq("id", match.id);
    if (matchError) { toast.error(matchError.message); setIsLoading(false); return; }

    const openIds = players.map((p) => p.openIntervalId).filter(Boolean) as string[];
    if (openIds.length > 0) {
      await supabase
        .from("playing_intervals")
        .update({ ended_at: now })
        .in("id", openIds);
    }

    setStatus("finished");
    setPlayers((prev) => prev.map((p) => ({ ...p, openIntervalId: null })));
    setIsLoading(false);
    toast.success("試合終了！");
  }, [match.id, players, supabase]);

  // --- 出場トグル ---
  const handlePlayingToggle = useCallback(
    async (playerId: string) => {
      if (status === "finished") return;
      const player = players.find((p) => p.member.id === playerId);
      if (!player) return;
      const now = new Date().toISOString();

      if (player.isPlaying) {
        // ベンチへ → 試合中ならインターバルをクローズ
        if (status === "active" && player.openIntervalId) {
          await supabase
            .from("playing_intervals")
            .update({ ended_at: now })
            .eq("id", player.openIntervalId);
        }
        setPlayers((prev) =>
          prev.map((p) =>
            p.member.id === playerId
              ? { ...p, isPlaying: false, openIntervalId: null }
              : p
          )
        );
      } else {
        // 出場へ → 試合中ならインターバルを開始（一時停止中は状態のみ変更）
        let newIntervalId: string | null = null;
        if (status === "active") {
          const { data } = await supabase
            .from("playing_intervals")
            .insert({ match_id: match.id, member_id: playerId, started_at: now })
            .select("id")
            .single();
          newIntervalId = data?.id ?? null;
        }
        setPlayers((prev) =>
          prev.map((p) =>
            p.member.id === playerId
              ? { ...p, isPlaying: true, openIntervalId: newIntervalId }
              : p
          )
        );
      }
    },
    [match.id, players, status, supabase]
  );

  // --- 得点追加 ---
  const handleGoalAdd = useCallback(
    async (playerId: string) => {
      if (status === "finished") return;
      const { data, error } = await supabase
        .from("goals")
        .insert({ match_id: match.id, member_id: playerId })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }

      setPlayers((prev) =>
        prev.map((p) =>
          p.member.id === playerId ? { ...p, goals: p.goals + 1 } : p
        )
      );
      setGoalIds((prev) => ({
        ...prev,
        [playerId]: [...(prev[playerId] ?? []), data.id],
      }));
    },
    [match.id, status, supabase]
  );

  // --- 得点削除 ---
  const handleGoalRemove = useCallback(
    async (playerId: string) => {
      if (status === "finished") return;
      const ids = goalIds[playerId] ?? [];
      if (ids.length === 0) return;
      const lastId = ids[ids.length - 1];

      const { error } = await supabase.from("goals").delete().eq("id", lastId);
      if (error) { toast.error(error.message); return; }

      setPlayers((prev) =>
        prev.map((p) =>
          p.member.id === playerId ? { ...p, goals: Math.max(0, p.goals - 1) } : p
        )
      );
      setGoalIds((prev) => ({
        ...prev,
        [playerId]: ids.slice(0, -1),
      }));
    },
    [goalIds, status, supabase]
  );

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const badgeVariant =
    status === "active" ? "default" :
    status === "finished" ? "outline" : "secondary";
  const badgeLabel =
    status === "pending" ? "未開始" :
    status === "active" ? "進行中" :
    status === "paused" ? "一時停止中" : "終了";

  return (
    <div className="space-y-4 pb-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-2">
        <Link href={`/events/${eventId}`} className="text-muted-foreground">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold flex-1">
          第{match.match_number}試合
        </h1>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </div>

      {/* スコアボード */}
      <div className="rounded-xl border bg-card p-4 text-center">
        <div className="flex items-center justify-center gap-4">
          <div>
            <p className="text-sm text-blue-600 font-semibold">Aチーム</p>
            <p className="text-5xl font-bold text-blue-600">{scoreA}</p>
          </div>
          <div className="text-muted-foreground">
            <p className="text-2xl font-light">-</p>
            {status !== "pending" && (
              <p className={cn(
                "text-lg font-mono font-medium",
                status === "paused" && "opacity-50"
              )}>
                {formatElapsed(elapsed)}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-green-600 font-semibold">Bチーム</p>
            <p className="text-5xl font-bold text-green-600">{scoreB}</p>
          </div>
        </div>
      </div>

      {/* タイマー操作ボタン */}
      {status === "pending" && (
        <Button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
        >
          <Play size={20} className="mr-2" />
          キックオフ
        </Button>
      )}
      {status === "active" && (
        <div className="flex gap-2">
          <Button
            onClick={handlePause}
            disabled={isLoading}
            className="flex-1 h-14 text-base font-bold bg-amber-500 hover:bg-amber-600 text-white border-0"
          >
            <Pause size={20} className="mr-2" />
            一時停止
          </Button>
          <Button
            onClick={handleStop}
            disabled={isLoading}
            variant="destructive"
            className="flex-1 h-14 text-base font-bold"
          >
            <Square size={20} className="mr-2" />
            試合終了
          </Button>
        </div>
      )}
      {status === "paused" && (
        <div className="flex gap-2">
          <Button
            onClick={handleResume}
            disabled={isLoading}
            className="flex-1 h-14 text-base font-bold bg-green-600 hover:bg-green-700"
          >
            <RotateCcw size={20} className="mr-2" />
            再開
          </Button>
          <Button
            onClick={handleStop}
            disabled={isLoading}
            variant="destructive"
            className="flex-1 h-14 text-base font-bold"
          >
            <Square size={20} className="mr-2" />
            試合終了
          </Button>
        </div>
      )}

      {/* プレイヤーカード */}
      {[
        { team: "A" as const, teamPlayers: teamA, color: "blue" as const },
        { team: "B" as const, teamPlayers: teamB, color: "green" as const },
      ].map(({ team, teamPlayers, color }) => (
        <section key={team} className="space-y-2">
          <h2
            className={cn(
              "font-bold text-sm px-1",
              color === "blue" ? "text-blue-600" : "text-green-600"
            )}
          >
            {team}チーム
          </h2>
          {teamPlayers.map((p) => (
            <PlayerCard
              key={p.member.id}
              player={p}
              color={color}
              matchStatus={status}
              onPlayingToggle={handlePlayingToggle}
              onGoalAdd={handleGoalAdd}
              onGoalRemove={handleGoalRemove}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function PlayerCard({
  player,
  color,
  matchStatus,
  onPlayingToggle,
  onGoalAdd,
  onGoalRemove,
}: {
  player: PlayerState;
  color: "blue" | "green";
  matchStatus: Match["status"];
  onPlayingToggle: (id: string) => void;
  onGoalAdd: (id: string) => void;
  onGoalRemove: (id: string) => void;
}) {
  const isFinished = matchStatus === "finished";

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex items-center gap-3 transition-colors",
        player.isPlaying
          ? color === "blue"
            ? "bg-blue-50 border-blue-200 dark:bg-blue-950"
            : "bg-green-50 border-green-200 dark:bg-green-950"
          : "bg-muted/40 border-muted"
      )}
    >
      {/* 出場トグル */}
      <button
        onClick={() => !isFinished && onPlayingToggle(player.member.id)}
        disabled={isFinished}
        className={cn(
          "w-16 py-2 rounded-lg text-xs font-bold transition-colors border",
          player.isPlaying
            ? color === "blue"
              ? "bg-blue-500 text-white border-blue-500"
              : "bg-green-500 text-white border-green-500"
            : "bg-background text-muted-foreground border-muted"
        )}
      >
        {player.isPlaying ? "出場中" : "ベンチ"}
      </button>

      {/* 名前 */}
      <span
        className={cn(
          "flex-1 font-semibold text-base",
          !player.isPlaying && "text-muted-foreground"
        )}
      >
        {player.member.name}
      </span>

      {/* 得点操作 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => !isFinished && onGoalRemove(player.member.id)}
          disabled={isFinished || player.goals === 0}
          className={cn(
            "w-10 h-10 rounded-full border text-lg font-bold transition-colors",
            player.goals > 0 && !isFinished
              ? "bg-background hover:bg-muted"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Minus size={16} className="mx-auto" />
        </button>
        <span className="w-8 text-center font-bold text-xl tabular-nums">
          {player.goals}
        </span>
        <button
          onClick={() => !isFinished && onGoalAdd(player.member.id)}
          disabled={isFinished}
          className={cn(
            "w-10 h-10 rounded-full border text-lg font-bold transition-colors",
            !isFinished
              ? color === "blue"
                ? "bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                : "bg-green-500 text-white hover:bg-green-600 border-green-500"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Plus size={16} className="mx-auto" />
        </button>
      </div>
    </div>
  );
}
