"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import {
  addGoal,
  removeGoal,
  setPlayerPlaying,
  transitionMatch,
} from "@/app/actions/matches";
import PasscodeDialog from "@/components/PasscodeDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateElapsedSeconds } from "@/lib/matches/timer";
import { cn } from "@/lib/utils";
import type { Match, Member } from "@/types";

export type MatchPlayer = {
  member: Member;
  side: 1 | 2;
  goals: number;
  isPlaying: boolean;
};

export type MatchTeamDisplay = {
  matchTeamId: string;
  eventTeamId: string;
  side: 1 | 2;
  teamCode: "A" | "B" | "C" | "D";
  displayName: string;
};

type RestingTeam = Pick<MatchTeamDisplay, "teamCode" | "displayName">;

type Props = {
  match: Match;
  initialPlayers: MatchPlayer[];
  initialGoalIds: Record<string, string[]>;
  eventId: string;
  teams: MatchTeamDisplay[];
  restingTeams: RestingTeam[];
  initialCanManage: boolean;
};

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "通信に失敗しました";
}

export default function MatchClient({
  match,
  initialPlayers,
  initialGoalIds,
  eventId,
  teams,
  restingTeams,
  initialCanManage,
}: Props) {
  const [players, setPlayers] = useState(initialPlayers);
  const [goalIds, setGoalIds] =
    useState<Record<string, string[]>>(initialGoalIds);
  const [matchState, setMatchState] = useState(match);
  const [elapsed, setElapsed] = useState(match.elapsed_seconds);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingPlayingIds, setPendingPlayingIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingGoalIds, setPendingGoalIds] = useState<Set<string>>(
    new Set()
  );

  const status = matchState.status;

  useEffect(() => {
    const updateElapsed = () => {
      setElapsed(
        calculateElapsedSeconds({
          elapsedSeconds: matchState.elapsed_seconds,
          activeStartedAt: matchState.active_started_at,
        })
      );
    };

    updateElapsed();
    if (status !== "active") return;

    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [matchState.active_started_at, matchState.elapsed_seconds, status]);

  const orderedTeams = useMemo(
    () => [...teams].sort((first, second) => first.side - second.side),
    [teams]
  );
  const playersBySide = useMemo(
    () => ({
      1: players.filter((player) => player.side === 1),
      2: players.filter((player) => player.side === 2),
    }),
    [players]
  );
  const scores = useMemo(
    () => ({
      1: playersBySide[1].reduce((sum, player) => sum + player.goals, 0),
      2: playersBySide[2].reduce((sum, player) => sum + player.goals, 0),
    }),
    [playersBySide]
  );

  const handleTransition = useCallback(
    async (nextStatus: Match["status"]) => {
      if (!canManage || isTransitioning || status === "finished") return;
      if (
        nextStatus === "finished" &&
        !window.confirm("試合を終了しますか？")
      ) {
        return;
      }

      setIsTransitioning(true);
      try {
        const result = await transitionMatch(
          eventId,
          matchState.id,
          status,
          nextStatus
        );
        if (result.error || !result.data) {
          toast.error(result.error ?? "試合状態を更新できませんでした");
          return;
        }

        setMatchState(result.data);
        setElapsed(
          calculateElapsedSeconds({
            elapsedSeconds: result.data.elapsed_seconds,
            activeStartedAt: result.data.active_started_at,
          })
        );
        if (nextStatus === "finished") toast.success("試合終了！");
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setIsTransitioning(false);
      }
    }, [canManage, eventId, isTransitioning, matchState.id, status]
  );

  const handlePlayingToggle = useCallback(
    async (memberId: string) => {
      if (!canManage || status === "finished" || pendingPlayingIds.has(memberId)) {
        return;
      }
      const player = players.find((item) => item.member.id === memberId);
      if (!player) return;

      const nextIsPlaying = !player.isPlaying;
      setPendingPlayingIds((current) => new Set(current).add(memberId));
      setPlayers((current) =>
        current.map((item) =>
          item.member.id === memberId
            ? { ...item, isPlaying: nextIsPlaying }
            : item
        )
      );

      try {
        const result = await setPlayerPlaying(
          matchState.id,
          memberId,
          nextIsPlaying
        );
        if (result.error) throw new Error(result.error);
      } catch (error) {
        setPlayers((current) =>
          current.map((item) =>
            item.member.id === memberId
              ? { ...item, isPlaying: player.isPlaying }
              : item
          )
        );
        toast.error(errorMessage(error));
      } finally {
        setPendingPlayingIds((current) => {
          const next = new Set(current);
          next.delete(memberId);
          return next;
        });
      }
    }, [canManage, matchState.id, pendingPlayingIds, players, status]
  );

  const handleGoalAdd = useCallback(
    async (memberId: string) => {
      if (!canManage || pendingGoalIds.has(memberId)) {
        return;
      }

      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      setPendingGoalIds((current) => new Set(current).add(memberId));
      setPlayers((current) =>
        current.map((player) =>
          player.member.id === memberId
            ? { ...player, goals: player.goals + 1 }
            : player
        )
      );
      setGoalIds((current) => ({
        ...current,
        [memberId]: [...(current[memberId] ?? []), optimisticId],
      }));

      try {
        const result = await addGoal(matchState.id, memberId);
        if (result.error || !result.id) {
          throw new Error(result.error ?? "得点を保存できませんでした");
        }
        setGoalIds((current) => ({
          ...current,
          [memberId]: (current[memberId] ?? []).map((id) =>
            id === optimisticId ? result.id! : id
          ),
        }));
      } catch (error) {
        setPlayers((current) =>
          current.map((player) =>
            player.member.id === memberId
              ? { ...player, goals: Math.max(0, player.goals - 1) }
              : player
          )
        );
        setGoalIds((current) => ({
          ...current,
          [memberId]: (current[memberId] ?? []).filter(
            (id) => id !== optimisticId
          ),
        }));
        toast.error(errorMessage(error));
      } finally {
        setPendingGoalIds((current) => {
          const next = new Set(current);
          next.delete(memberId);
          return next;
        });
      }
    }, [canManage, matchState.id, pendingGoalIds]
  );

  const handleGoalRemove = useCallback(
    async (memberId: string) => {
      if (!canManage || pendingGoalIds.has(memberId)) {
        return;
      }
      const memberGoalIds = goalIds[memberId] ?? [];
      const goalId = memberGoalIds.at(-1);
      if (!goalId) return;

      setPendingGoalIds((current) => new Set(current).add(memberId));
      setPlayers((current) =>
        current.map((player) =>
          player.member.id === memberId
            ? { ...player, goals: Math.max(0, player.goals - 1) }
            : player
        )
      );
      setGoalIds((current) => ({
        ...current,
        [memberId]: (current[memberId] ?? []).slice(0, -1),
      }));

      try {
        const result = await removeGoal(matchState.id, memberId, goalId);
        if (result.error) throw new Error(result.error);
      } catch (error) {
        setPlayers((current) =>
          current.map((player) =>
            player.member.id === memberId
              ? { ...player, goals: player.goals + 1 }
              : player
          )
        );
        setGoalIds((current) => ({
          ...current,
          [memberId]: [...(current[memberId] ?? []), goalId],
        }));
        toast.error(errorMessage(error));
      } finally {
        setPendingGoalIds((current) => {
          const next = new Set(current);
          next.delete(memberId);
          return next;
        });
      }
    }, [canManage, goalIds, matchState.id, pendingGoalIds]
  );

  const badgeVariant =
    status === "active"
      ? "default"
      : status === "finished"
        ? "outline"
        : "secondary";
  const badgeLabel =
    status === "pending"
      ? "未開始"
      : status === "active"
        ? "進行中"
        : status === "paused"
          ? "一時停止中"
          : "終了";

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Link
          href={`/events/${eventId}`}
          className="text-muted-foreground"
          aria-label="イベント詳細へ戻る"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-xl font-bold">
          第{matchState.match_number}試合
        </h1>
        <Badge variant={badgeVariant} data-testid="match-status">
          {badgeLabel}
        </Badge>
      </div>

      <div className="rounded-xl border bg-card p-4 text-center">
        <div className="flex items-center justify-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-blue-600">
              {orderedTeams[0]?.displayName}
            </p>
            <p className="text-5xl font-bold text-blue-600" data-testid="score-side-1">
              {scores[1]}
            </p>
          </div>
          <div className="text-muted-foreground">
            <p className="text-2xl font-light">-</p>
            {status !== "pending" && (
              <p
                className={cn(
                  "font-mono text-lg font-medium",
                  status === "paused" && "opacity-50"
                )}
                aria-label={`経過時間 ${formatElapsed(elapsed)}`}
              >
                {formatElapsed(elapsed)}
              </p>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-green-600">
              {orderedTeams[1]?.displayName}
            </p>
            <p className="text-5xl font-bold text-green-600" data-testid="score-side-2">
              {scores[2]}
            </p>
          </div>
        </div>
        {restingTeams.length > 0 && (
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            休憩: {restingTeams.map((team) => team.displayName).join("・")}
          </p>
        )}
      </div>

      {!canManage && (
        <Button
          onClick={() => setPasscodeOpen(true)}
          className="h-14 w-full text-lg font-bold"
        >
          {status === "finished" ? "得点を修正" : "記録を開始"}
        </Button>
      )}

      {canManage && status === "pending" && (
        <Button
          onClick={() => handleTransition("active")}
          disabled={isTransitioning}
          className="h-14 w-full bg-green-600 text-lg font-bold hover:bg-green-700"
        >
          <Play size={20} className="mr-2" />
          キックオフ
        </Button>
      )}
      {canManage && status === "active" && (
        <div className="flex gap-2">
          <Button
            onClick={() => handleTransition("paused")}
            disabled={isTransitioning}
            className="h-14 flex-1 border-0 bg-amber-500 text-base font-bold text-white hover:bg-amber-600"
          >
            <Pause size={20} className="mr-2" />
            一時停止
          </Button>
          <Button
            onClick={() => handleTransition("finished")}
            disabled={isTransitioning}
            variant="destructive"
            className="h-14 flex-1 text-base font-bold"
          >
            <Square size={20} className="mr-2" />
            試合終了
          </Button>
        </div>
      )}
      {canManage && status === "paused" && (
        <div className="flex gap-2">
          <Button
            onClick={() => handleTransition("active")}
            disabled={isTransitioning}
            className="h-14 flex-1 bg-green-600 text-base font-bold hover:bg-green-700"
          >
            <RotateCcw size={20} className="mr-2" />
            再開
          </Button>
          <Button
            onClick={() => handleTransition("finished")}
            disabled={isTransitioning}
            variant="destructive"
            className="h-14 flex-1 text-base font-bold"
          >
            <Square size={20} className="mr-2" />
            試合終了
          </Button>
        </div>
      )}

      {orderedTeams.map((team, index) => {
        const color = index === 0 ? "blue" : "green";
        return (
          <section key={team.matchTeamId} className="space-y-2">
            <h2
              className={cn(
                "px-1 text-sm font-bold",
                color === "blue" ? "text-blue-600" : "text-green-600"
              )}
            >
              {team.displayName}
            </h2>
            {playersBySide[team.side].map((player) => (
              <PlayerCard
                key={player.member.id}
                player={player}
                color={color}
                canManage={canManage}
                matchStatus={status}
                isPlayingPending={pendingPlayingIds.has(player.member.id)}
                isGoalPending={pendingGoalIds.has(player.member.id)}
                onPlayingToggle={handlePlayingToggle}
                onGoalAdd={handleGoalAdd}
                onGoalRemove={handleGoalRemove}
              />
            ))}
          </section>
        );
      })}

      <PasscodeDialog
        open={passcodeOpen}
        onClose={() => setPasscodeOpen(false)}
        onConfirm={() => setCanManage(true)}
      />
    </div>
  );
}

function PlayerCard({
  player,
  color,
  canManage,
  matchStatus,
  isPlayingPending,
  isGoalPending,
  onPlayingToggle,
  onGoalAdd,
  onGoalRemove,
}: {
  player: MatchPlayer;
  color: "blue" | "green";
  canManage: boolean;
  matchStatus: Match["status"];
  isPlayingPending: boolean;
  isGoalPending: boolean;
  onPlayingToggle: (id: string) => void;
  onGoalAdd: (id: string) => void;
  onGoalRemove: (id: string) => void;
}) {
  const isPlayingReadOnly = !canManage || matchStatus === "finished";
  const isGoalReadOnly = !canManage;
  const playingLabel = player.isPlaying ? "出場中" : "ベンチ";
  const playingClassName = cn(
    "min-h-11 w-16 rounded-lg border py-2 text-xs font-bold transition-colors",
    player.isPlaying
      ? color === "blue"
        ? "border-blue-500 bg-blue-500 text-white"
        : "border-green-500 bg-green-500 text-white"
      : "border-muted bg-background text-muted-foreground"
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
        player.isPlaying
          ? color === "blue"
            ? "border-blue-200 bg-blue-50 dark:bg-blue-950"
            : "border-green-200 bg-green-50 dark:bg-green-950"
          : "border-muted bg-muted/40"
      )}
    >
      {isPlayingReadOnly ? (
        <span className={playingClassName}>{playingLabel}</span>
      ) : (
        <button
          type="button"
          onClick={() => onPlayingToggle(player.member.id)}
          disabled={isPlayingPending}
          className={playingClassName}
          aria-label={`${player.member.name}を${player.isPlaying ? "ベンチ" : "出場中"}に変更`}
        >
          {playingLabel}
        </button>
      )}

      <span
        className={cn(
          "flex-1 text-base font-semibold",
          !player.isPlaying && "text-muted-foreground"
        )}
      >
        {player.member.name}
      </span>

      <div className="flex items-center gap-2">
        {!isGoalReadOnly && (
          <button
            type="button"
            onClick={() => onGoalRemove(player.member.id)}
            disabled={isGoalPending || player.goals === 0}
            className={cn(
              "h-11 w-11 rounded-full border text-lg font-bold transition-colors",
              player.goals > 0
                ? "bg-background hover:bg-muted"
                : "bg-muted text-muted-foreground"
            )}
            aria-label={`${player.member.name}の得点を1点取り消す`}
          >
            <Minus size={16} className="mx-auto" />
          </button>
        )}
        <span
          className="w-8 text-center text-xl font-bold tabular-nums"
          aria-label={`${player.member.name} ${player.goals}得点`}
        >
          {player.goals}
        </span>
        {!isGoalReadOnly && (
          <button
            type="button"
            onClick={() => onGoalAdd(player.member.id)}
            disabled={isGoalPending}
            className={cn(
              "h-11 w-11 rounded-full border text-lg font-bold text-white transition-colors",
              color === "blue"
                ? "border-blue-500 bg-blue-500 hover:bg-blue-600"
                : "border-green-500 bg-green-500 hover:bg-green-600"
            )}
            aria-label={`${player.member.name}に1点追加`}
          >
            <Plus size={16} className="mx-auto" />
          </button>
        )}
      </div>
    </div>
  );
}
