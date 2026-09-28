"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { addGoal, removeGoal } from "@/app/actions/matches";
import { Badge } from "@/components/ui/badge";

export type LegacyMatchPlayer = {
  id: string;
  name: string;
  matchGoals: number;
  dailyGoals: number;
  goalIds: string[];
};

export type LegacyMatchTeam = {
  id: string;
  teamCode: string;
  displayName: string;
  players: LegacyMatchPlayer[];
};

function updatePlayer(
  teams: LegacyMatchTeam[],
  memberId: string,
  update: (player: LegacyMatchPlayer) => LegacyMatchPlayer,
) {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((player) =>
      player.id === memberId ? update(player) : player,
    ),
  }));
}

export default function LegacyMatchScoringClient({
  matchId,
  initialTeams,
}: {
  matchId: string;
  initialTeams: LegacyMatchTeam[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function add(memberId: string) {
    if (pendingIds.has(memberId)) return;
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    setPendingIds((current) => new Set(current).add(memberId));
    setTeams((current) =>
      updatePlayer(current, memberId, (player) => ({
        ...player,
        matchGoals: player.matchGoals + 1,
        dailyGoals: player.dailyGoals + 1,
        goalIds: [...player.goalIds, optimisticId],
      })),
    );
    try {
      const result = await addGoal(matchId, memberId);
      if (result.error || !result.id) throw new Error(result.error ?? "得点を保存できませんでした");
      setTeams((current) =>
        updatePlayer(current, memberId, (player) => ({
          ...player,
          goalIds: player.goalIds.map((id) => (id === optimisticId ? result.id! : id)),
        })),
      );
    } catch (error) {
      setTeams((current) =>
        updatePlayer(current, memberId, (player) => ({
          ...player,
          matchGoals: Math.max(0, player.matchGoals - 1),
          dailyGoals: Math.max(0, player.dailyGoals - 1),
          goalIds: player.goalIds.filter((id) => id !== optimisticId),
        })),
      );
      toast.error(error instanceof Error ? error.message : "得点を保存できませんでした");
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  async function remove(memberId: string) {
    if (pendingIds.has(memberId)) return;
    const player = teams.flatMap((team) => team.players).find((item) => item.id === memberId);
    const goalId = player?.goalIds.at(-1);
    if (!goalId) return;
    setPendingIds((current) => new Set(current).add(memberId));
    setTeams((current) =>
      updatePlayer(current, memberId, (item) => ({
        ...item,
        matchGoals: Math.max(0, item.matchGoals - 1),
        dailyGoals: Math.max(0, item.dailyGoals - 1),
        goalIds: item.goalIds.filter((id) => id !== goalId),
      })),
    );
    try {
      const result = await removeGoal(matchId, memberId, goalId);
      if (result.error) throw new Error(result.error);
    } catch (error) {
      setTeams((current) =>
        updatePlayer(current, memberId, (item) => ({
          ...item,
          matchGoals: item.matchGoals + 1,
          dailyGoals: item.dailyGoals + 1,
          goalIds: [...item.goalIds, goalId],
        })),
      );
      toast.error(error instanceof Error ? error.message : "得点を取り消せませんでした");
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      {teams.map((team) => (
        <section key={team.id} className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Badge variant="outline">{team.teamCode}</Badge>
              {team.displayName}
            </h2>
            <span className="font-bold">
              {team.players.reduce((sum, player) => sum + player.matchGoals, 0)}点
            </span>
          </div>
          <ul className="space-y-2">
            {team.players.map((player) => {
              const pending = pendingIds.has(player.id);
              return (
                <li key={player.id} className="flex items-center gap-2 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground" aria-label={`${player.name} 本日 ${player.dailyGoals}点`}>
                      本日 {player.dailyGoals}点
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending || player.matchGoals === 0}
                    onClick={() => remove(player.id)}
                    className="h-11 w-11 rounded-full border disabled:opacity-40"
                    aria-label={`${player.name}の得点を1点取り消す`}
                  >
                    <Minus size={16} className="mx-auto" />
                  </button>
                  <span className="w-9 text-center text-xl font-bold" aria-label={`${player.name} この試合 ${player.matchGoals}点`}>
                    {player.matchGoals}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add(player.id)}
                    className="h-11 w-11 rounded-full border bg-primary text-primary-foreground disabled:opacity-40"
                    aria-label={`${player.name}の得点を1点追加`}
                  >
                    <Plus size={16} className="mx-auto" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
