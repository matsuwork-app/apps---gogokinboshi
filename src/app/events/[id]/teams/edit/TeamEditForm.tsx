"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createEventTurn } from "@/app/actions/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TeamForEdit = {
  id: string;
  teamCode: string;
  displayName: string;
  sortOrder: number;
};

export type MemberForTeamEdit = {
  id: string;
  name: string;
  eventTeamId: string;
  dailyGoals: number;
};

const TEAM_STYLES: Record<
  string,
  { panel: string; badge: string; title: string }
> = {
  A: {
    panel: "border-blue-200 bg-blue-50 dark:bg-blue-950/50",
    badge: "bg-blue-500 text-white",
    title: "text-blue-700 dark:text-blue-300",
  },
  B: {
    panel: "border-green-200 bg-green-50 dark:bg-green-950/50",
    badge: "bg-green-500 text-white",
    title: "text-green-700 dark:text-green-300",
  },
  C: {
    panel: "border-amber-200 bg-amber-50 dark:bg-amber-950/50",
    badge: "bg-amber-500 text-white",
    title: "text-amber-700 dark:text-amber-300",
  },
  D: {
    panel: "border-rose-200 bg-rose-50 dark:bg-rose-950/50",
    badge: "bg-rose-500 text-white",
    title: "text-rose-700 dark:text-rose-300",
  },
};

const FALLBACK_STYLE = {
  panel: "border-border bg-muted/40",
  badge: "bg-foreground text-background",
  title: "text-foreground",
};

export default function TeamEditForm({
  eventId,
  teams,
  members,
}: {
  eventId: string;
  teams: TeamForEdit[];
  members: MemberForTeamEdit[];
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((member) => [member.id, member.eventTeamId]),
    ),
  );
  const [isPending, startTransition] = useTransition();

  const hasUnassignedMember = members.some(
    (member) => !teams.some((team) => team.id === assignments[member.id]),
  );
  const emptyTeam = teams.find(
    (team) =>
      !members.some((member) => assignments[member.id] === team.id),
  );
  const cannotSave = hasUnassignedMember || Boolean(emptyTeam) || isPending;

  function distributeEvenly() {
    setAssignments(
      Object.fromEntries(
        members.map((member, index) => [
          member.id,
          teams[index % teams.length]?.id ?? "",
        ]),
      ),
    );
  }

  function saveAssignments() {
    if (hasUnassignedMember) {
      toast.error("すべての参加者をチームへ割り当ててください");
      return;
    }
    if (emptyTeam) {
      toast.error(`${emptyTeam.displayName}に1名以上割り当ててください`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await createEventTurn(
          eventId,
          members.map((member) => ({
            member_id: member.id,
            event_team_id: assignments[member.id],
          })),
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`第${result.turnNumber}ターンを作成しました`);
        router.push(`/events/${eventId}/turns/${result.turnId}`);
      } catch {
        toast.error("新しいターンを作成できませんでした");
      }
    });
  }

  function handleSave() {
    if (cannotSave) return;
    saveAssignments();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">チームを組み替えて新しいターンを作成します。</p>
        <p className="mt-1 text-muted-foreground">
          過去ターンの得点とメンバー構成は変わりません。
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">参加者の所属</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            全員をいずれかのチームへ割り当ててください。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={distributeEvenly}
          disabled={isPending}
        >
          均等に振り分け
        </Button>
      </div>

      <ul className="space-y-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{member.name}</p>
              <p className="text-xs text-muted-foreground">
                本日 {member.dailyGoals}点
              </p>
            </div>
            <label className="shrink-0">
              <span className="sr-only">{member.name}の所属チーム</span>
              <select
                aria-label={`${member.name}の所属チーム`}
                value={assignments[member.id] ?? ""}
                onChange={(event) =>
                  setAssignments((current) => ({
                    ...current,
                    [member.id]: event.target.value,
                  }))
                }
                disabled={isPending}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-medium disabled:opacity-50"
              >
                <option value="" disabled>
                  未割当
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.teamCode}: {team.displayName}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {teams.map((team) => {
          const style = TEAM_STYLES[team.teamCode] ?? FALLBACK_STYLE;
          const teamMembers = members.filter(
            (member) => assignments[member.id] === team.id,
          );
          return (
            <section
              key={team.id}
              className={cn("min-w-0 rounded-lg border p-3", style.panel)}
            >
              <div className="mb-2 flex items-center gap-2">
                <Badge className={style.badge}>{team.teamCode}</Badge>
                <h3 className={cn("truncate text-sm font-bold", style.title)}>
                  {team.displayName}（{teamMembers.length}名）
                </h3>
              </div>
              {teamMembers.length === 0 ? (
                <p className="text-sm text-destructive">1名以上必要です</p>
              ) : (
                <ul className="space-y-1">
                  {teamMembers.map((member) => (
                    <li key={member.id} className="truncate text-sm">
                      {member.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={cannotSave}
        className="w-full"
        size="lg"
      >
        {isPending ? "作成中..." : "新しいターンを作成"}
      </Button>
    </div>
  );
}
