"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createEvent } from "@/app/actions/events";
import { toast } from "sonner";
import type { Member } from "@/types";
import { cn } from "@/lib/utils";

type TeamCount = 2 | 3 | 4;
type TeamPosition = 1 | 2 | 3 | 4;

const TEAM_OPTIONS = [
  { position: 1, label: "A", selectedClass: "border-blue-500 bg-blue-500 text-white", panelClass: "border-blue-200 bg-blue-50 dark:bg-blue-950/50", titleClass: "text-blue-700 dark:text-blue-300" },
  { position: 2, label: "B", selectedClass: "border-green-500 bg-green-500 text-white", panelClass: "border-green-200 bg-green-50 dark:bg-green-950/50", titleClass: "text-green-700 dark:text-green-300" },
  { position: 3, label: "C", selectedClass: "border-amber-500 bg-amber-500 text-white", panelClass: "border-amber-200 bg-amber-50 dark:bg-amber-950/50", titleClass: "text-amber-700 dark:text-amber-300" },
  { position: 4, label: "D", selectedClass: "border-rose-500 bg-rose-500 text-white", panelClass: "border-rose-200 bg-rose-50 dark:bg-rose-950/50", titleClass: "text-rose-700 dark:text-rose-300" },
] as const;

export default function EventNewForm({ members, today }: { members: Member[]; today: string }) {
  const [teamCount, setTeamCount] = useState<TeamCount>(2);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Record<string, TeamPosition | null>>({});
  const [isPending, startTransition] = useTransition();

  const activeTeams = TEAM_OPTIONS.slice(0, teamCount);

  function changeTeamCount(nextCount: TeamCount) {
    setTeamCount(nextCount);
    setAssignments((previous) => Object.fromEntries(
      Object.entries(previous).map(([memberId, position]) => [
        memberId,
        position !== null && position <= nextCount ? position : null,
      ]),
    ));
  }

  function toggle(id: string) {
    const wasSelected = selectedIds.has(id);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      wasSelected ? next.delete(id) : next.add(id);
      return next;
    });
    if (wasSelected) {
      setAssignments((current) => ({ ...current, [id]: null }));
    }
  }

  function selectAll() {
    setSelectedIds(new Set(members.map((member) => member.id)));
  }

  function distributeEvenly() {
    if (selectedIds.size < teamCount) {
      toast.error(`${teamCount}チームには最低${teamCount}名必要です`);
      return;
    }
    const selectedMembers = members.filter((member) => selectedIds.has(member.id));
    setAssignments((previous) => ({
      ...previous,
      ...Object.fromEntries(selectedMembers.map((member, index) => [
        member.id,
        ((index % teamCount) + 1) as TeamPosition,
      ])),
    }));
  }

  function handleSubmit(formData: FormData) {
    const selectedMembers = members.filter((member) => selectedIds.has(member.id));
    const unassignedCount = selectedMembers.filter((member) => assignments[member.id] == null).length;
    const emptyTeam = activeTeams.find((team) =>
      !selectedMembers.some((member) => assignments[member.id] === team.position),
    );

    if (selectedMembers.length < teamCount) {
      toast.error(`${teamCount}チームには最低${teamCount}名必要です`);
      return;
    }
    if (unassignedCount > 0) {
      toast.error(`未割当の参加者が${unassignedCount}名います`);
      return;
    }
    if (emptyTeam) {
      toast.error(`${emptyTeam.label}チームに1名以上割り当ててください`);
      return;
    }

    selectedMembers.forEach((member) => formData.append("member_ids", member.id));
    formData.set("team_count", String(teamCount));
    formData.set("team_assignments", JSON.stringify(
      selectedMembers.map((member) => ({ member_id: member.id, position: assignments[member.id] })),
    ));
    startTransition(async () => {
      const result = await createEvent(formData);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="event_date">日付</Label>
          <Input id="event_date" name="event_date" type="date" defaultValue={today} required className="max-w-xs" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">メモ（任意）</Label>
          <Input id="notes" name="notes" placeholder="例: 公園グラウンド" />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">チーム数</legend>
          <div className="grid grid-cols-3 gap-2">
            {([2, 3, 4] as const).map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={teamCount === count}
                onClick={() => changeTeamCount(count)}
                className={cn(
                  "min-h-11 rounded-lg border px-2 py-2 text-sm font-bold transition-colors",
                  teamCount === count ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {count}チーム
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>参加メンバー（{selectedIds.size}名選択中）</Label>
            <button type="button" onClick={selectAll} className="text-sm text-primary underline">全選択</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {members.map((member) => {
              const selected = selectedIds.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(member.id)}
                  className={cn(
                    "min-w-0 rounded-lg border p-3 text-left font-medium transition-colors",
                    selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  <span className="block truncate">{member.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>チーム割り当て</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  各参加者をA〜{activeTeams.at(-1)?.label}のいずれかへ割り当てます
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={distributeEvenly}>均等に振り分け</Button>
            </div>

            <ul className="space-y-2">
              {members.filter((member) => selectedIds.has(member.id)).map((member) => (
                <li key={member.id} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 truncate font-medium">{member.name}</span>
                  <div className="grid shrink-0 gap-1" style={{ gridTemplateColumns: `repeat(${teamCount}, minmax(0, 1fr))` }}>
                    {activeTeams.map((team) => (
                      <button
                        key={team.position}
                        type="button"
                        aria-label={`${member.name}を${team.label}チームに割り当てる`}
                        aria-pressed={assignments[member.id] === team.position}
                        onClick={() => setAssignments((previous) => ({ ...previous, [member.id]: team.position }))}
                        className={cn(
                          "min-h-11 min-w-11 rounded-md border px-3 text-sm font-bold transition-colors",
                          assignments[member.id] === team.position ? team.selectedClass : "bg-background hover:bg-muted",
                        )}
                      >
                        {team.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              {activeTeams.map((team) => {
                const teamMembers = members.filter((member) =>
                  selectedIds.has(member.id) && assignments[member.id] === team.position,
                );
                return (
                  <div key={team.position} className={cn("min-w-0 rounded-lg border p-3 text-sm", team.panelClass)}>
                    <p className={cn("mb-1 font-bold", team.titleClass)}>{team.label}チーム（{teamMembers.length}名）</p>
                    {teamMembers.length === 0 ? (
                      <p className="text-muted-foreground">未割当</p>
                    ) : teamMembers.map((member) => <p key={member.id} className="truncate">{member.name}</p>)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button type="submit" disabled={isPending || selectedIds.size < teamCount} className="w-full" size="lg">
          {isPending ? "作成中..." : "イベントを作成する"}
        </Button>
    </form>
  );
}
