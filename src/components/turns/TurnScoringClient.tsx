"use client";

import { ArrowLeft, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { addTurnGoal, removeTurnGoal } from "@/app/actions/turns";
import { Badge } from "@/components/ui/badge";
import {
  adjustTurnGoalCounts,
  appendGoalId,
  removeGoalId,
  replaceGoalId,
  type TurnTeam,
} from "@/lib/turns/scoring";
import { cn } from "@/lib/utils";

import CountdownTimer from "./CountdownTimer";

type Props = {
  eventId: string;
  turnId: string;
  turnNumber: number;
  initialTeams: TurnTeam[];
};

const TEAM_STYLES: Record<string, { panel: string; badge: string }> = {
  A: {
    panel: "border-blue-200 bg-blue-50/70 dark:bg-blue-950/40",
    badge: "bg-blue-500 text-white",
  },
  B: {
    panel: "border-green-200 bg-green-50/70 dark:bg-green-950/40",
    badge: "bg-green-500 text-white",
  },
  C: {
    panel: "border-amber-200 bg-amber-50/70 dark:bg-amber-950/40",
    badge: "bg-amber-500 text-white",
  },
  D: {
    panel: "border-rose-200 bg-rose-50/70 dark:bg-rose-950/40",
    badge: "bg-rose-500 text-white",
  },
};

const FALLBACK_STYLE = {
  panel: "border-border bg-muted/30",
  badge: "bg-foreground text-background",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "通信に失敗しました";
}

export default function TurnScoringClient({
  eventId,
  turnId,
  turnNumber,
  initialTeams,
}: Props) {
  const [teams, setTeams] = useState(() =>
    [...initialTeams].sort((first, second) => first.sortOrder - second.sortOrder)
  );
  const [pendingMemberIds, setPendingMemberIds] = useState(
    () => new Set<string>()
  );

  async function handleGoalAdd(memberId: string) {
    if (pendingMemberIds.has(memberId)) return;

    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    setPendingMemberIds((current) => new Set(current).add(memberId));
    setTeams((current) =>
      appendGoalId(
        adjustTurnGoalCounts(current, memberId, 1),
        memberId,
        optimisticId
      )
    );

    try {
      const result = await addTurnGoal(turnId, memberId);
      if (result.error || !result.id) {
        throw new Error(result.error ?? "得点を保存できませんでした");
      }
      const savedGoalId = result.id;
      setTeams((current) =>
        replaceGoalId(current, memberId, optimisticId, savedGoalId)
      );
    } catch (error) {
      setTeams((current) =>
        adjustTurnGoalCounts(
          removeGoalId(current, memberId, optimisticId),
          memberId,
          -1
        )
      );
      toast.error(errorMessage(error));
    } finally {
      setPendingMemberIds((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  async function handleGoalRemove(memberId: string) {
    if (pendingMemberIds.has(memberId)) return;
    const player = teams
      .flatMap((team) => team.players)
      .find((candidate) => candidate.id === memberId);
    const goalId = player?.goalIds.at(-1);
    if (!goalId) return;

    setPendingMemberIds((current) => new Set(current).add(memberId));
    setTeams((current) =>
      adjustTurnGoalCounts(
        removeGoalId(current, memberId, goalId),
        memberId,
        -1
      )
    );

    try {
      const result = await removeTurnGoal(turnId, memberId, goalId);
      if (result.error) throw new Error(result.error);
    } catch (error) {
      setTeams((current) =>
        appendGoalId(
          adjustTurnGoalCounts(current, memberId, 1),
          memberId,
          goalId
        )
      );
      toast.error(errorMessage(error));
    } finally {
      setPendingMemberIds((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Link
          href={`/events/${eventId}`}
          aria-label="イベント詳細へ戻る"
          className="text-muted-foreground"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">第{turnNumber}ターン</h1>
      </div>

      <CountdownTimer />

      <div className="space-y-4">
        {teams.map((team) => {
          const style = TEAM_STYLES[team.teamCode] ?? FALLBACK_STYLE;
          const teamScore = team.players.reduce(
            (total, player) => total + player.turnGoals,
            0
          );

          return (
            <section
              key={team.id}
              className={cn("rounded-xl border p-4", style.panel)}
              aria-labelledby={`turn-team-${team.id}`}
            >
              <div className="mb-3 flex items-center gap-2">
                <Badge className={cn("font-bold", style.badge)}>
                  {team.teamCode}
                </Badge>
                <h2 id={`turn-team-${team.id}`} className="min-w-0 flex-1 truncate font-bold">
                  {team.displayName}
                </h2>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  チーム {teamScore}点
                </span>
              </div>

              <div className="space-y-2">
                {team.players.map((player) => {
                  const isPending = pendingMemberIds.has(player.id);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 rounded-lg border bg-background/90 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{player.name}</p>
                        <p
                          className="text-xs text-muted-foreground tabular-nums"
                          aria-label={`${player.name} 本日 ${player.dailyGoals}点`}
                        >
                          本日 {player.dailyGoals}点
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGoalRemove(player.id)}
                        disabled={isPending || player.turnGoals === 0}
                        className="h-11 w-11 rounded-full border bg-background disabled:bg-muted disabled:text-muted-foreground"
                        aria-label={`${player.name}の得点を1点取り消す`}
                      >
                        <Minus size={16} className="mx-auto" />
                      </button>
                      <span
                        className="w-9 text-center text-xl font-bold tabular-nums"
                        aria-label={`${player.name} ターン得点 ${player.turnGoals}点`}
                      >
                        {player.turnGoals}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGoalAdd(player.id)}
                        disabled={isPending}
                        className={cn(
                          "h-11 w-11 rounded-full border text-white disabled:opacity-50",
                          style.badge
                        )}
                        aria-label={`${player.name}の得点を1点追加`}
                      >
                        <Plus size={16} className="mx-auto" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
