"use client";

import { useState, useTransition } from "react";
import type { Member } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createMatch } from "@/app/actions/matches";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getNextRecommendedPair,
  getRestingTeamIds,
  type MatchPair,
} from "@/lib/teams/rotation";
import PasscodeDialog from "@/components/PasscodeDialog";

export type EventTeamForMatch = {
  id: string;
  team_code: string;
  display_name: string;
  sort_order: number;
  members: Member[];
};

const TEAM_STYLES: Record<
  string,
  { panel: string; badge: string; text: string }
> = {
  A: {
    panel: "border-blue-200 bg-blue-50 dark:bg-blue-950/50",
    badge: "bg-blue-500 text-white",
    text: "text-blue-700 dark:text-blue-300",
  },
  B: {
    panel: "border-green-200 bg-green-50 dark:bg-green-950/50",
    badge: "bg-green-500 text-white",
    text: "text-green-700 dark:text-green-300",
  },
  C: {
    panel: "border-amber-200 bg-amber-50 dark:bg-amber-950/50",
    badge: "bg-amber-500 text-white",
    text: "text-amber-700 dark:text-amber-300",
  },
  D: {
    panel: "border-rose-200 bg-rose-50 dark:bg-rose-950/50",
    badge: "bg-rose-500 text-white",
    text: "text-rose-700 dark:text-rose-300",
  },
};

const FALLBACK_STYLE = {
  panel: "border-border bg-muted/40",
  badge: "bg-foreground text-background",
  text: "text-foreground",
};

export default function MatchNewForm({
  teams,
  eventId,
  matchHistory,
  initialCanManage,
}: {
  teams: EventTeamForMatch[];
  eventId: string;
  matchHistory: MatchPair[];
  initialCanManage: boolean;
}) {
  const teamIds = teams.map((team) => team.id);
  const recommendedPair = getNextRecommendedPair(teamIds, matchHistory);
  const [firstTeamId, setFirstTeamId] = useState(recommendedPair[0]);
  const [secondTeamId, setSecondTeamId] = useState(recommendedPair[1]);
  const [isPending, startTransition] = useTransition();
  const [canManage, setCanManage] = useState(initialCanManage);
  const [dialogOpen, setDialogOpen] = useState(false);

  const selectedPair: MatchPair = [firstTeamId, secondTeamId];
  const isSameTeam = firstTeamId === secondTeamId;
  const restingTeamIds = isSameTeam
    ? teamIds.filter((teamId) => teamId !== firstTeamId)
    : getRestingTeamIds(teamIds, selectedPair);
  const restingTeams = teams.filter((team) => restingTeamIds.includes(team.id));
  const isRecommended =
    (firstTeamId === recommendedPair[0] && secondTeamId === recommendedPair[1]) ||
    (firstTeamId === recommendedPair[1] && secondTeamId === recommendedPair[0]);

  function createSelectedMatch() {
    if (isSameTeam) {
      toast.error("異なる2チームを選択してください");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createMatch(eventId, firstTeamId, secondTeamId);
        if (result?.error) toast.error(result.error);
      } catch {
        setCanManage(false);
        setDialogOpen(true);
        toast.error("管理パスコードをもう一度入力してください");
      }
    });
  }

  function handleSubmit() {
    if (canManage) createSelectedMatch();
    else setDialogOpen(true);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="font-semibold">対戦チーム</p>
          {isRecommended && <Badge variant="secondary">おすすめ</Badge>}
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <label className="min-w-0">
            <span className="sr-only">1チーム目</span>
            <select
              value={firstTeamId}
              onChange={(event) => setFirstTeamId(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm font-medium"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_code}: {team.display_name}
                </option>
              ))}
            </select>
          </label>

          <span className="shrink-0 text-sm font-bold text-muted-foreground">VS</span>

          <label className="min-w-0">
            <span className="sr-only">2チーム目</span>
            <select
              value={secondTeamId}
              onChange={(event) => setSecondTeamId(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm font-medium"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_code}: {team.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isSameTeam && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            異なる2チームを選択してください
          </p>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {teams
          .filter((team) => selectedPair.includes(team.id))
          .map((team) => {
            const style = TEAM_STYLES[team.team_code] ?? FALLBACK_STYLE;
            return (
              <section key={team.id} className={cn("min-w-0 rounded-lg border p-4", style.panel)}>
                <div className="mb-2 flex min-w-0 items-center gap-2">
                  <Badge className={cn("shrink-0 font-bold", style.badge)}>{team.team_code}</Badge>
                  <h2 className={cn("min-w-0 truncate font-bold", style.text)}>{team.display_name}</h2>
                </div>
                <div className="space-y-1 text-sm">
                  {team.members.length === 0 ? (
                    <p className="text-muted-foreground">メンバーがいません</p>
                  ) : (
                    team.members.map((member) => <p key={member.id} className="truncate">{member.name}</p>)
                  )}
                </div>
              </section>
            );
          })}
      </div>

      {restingTeams.length > 0 && (
        <section className="space-y-2 rounded-lg border border-dashed bg-muted/30 p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">休憩チーム</h2>
          <div className="flex min-w-0 flex-wrap gap-2">
            {restingTeams.map((team) => (
              <Badge key={team.id} variant="outline" className="max-w-full">
                <span className="truncate">{team.team_code}: {team.display_name}</span>
              </Badge>
            ))}
          </div>
        </section>
      )}

      <Button onClick={handleSubmit} disabled={isSameTeam || isPending} className="w-full" size="lg">
        {isPending ? "作成中..." : "この対戦で試合を開始する"}
      </Button>
      <PasscodeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => {
          setCanManage(true);
          createSelectedMatch();
        }}
      />
    </div>
  );
}
