"use client";

import { useState, useTransition } from "react";
import type { Member } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createMatch } from "@/app/actions/matches";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TeamAssignment = "A" | "B" | null;

export default function MatchNewForm({
  members,
  eventId,
}: {
  members: Member[];
  eventId: string;
}) {
  const [assignments, setAssignments] = useState<Record<string, TeamAssignment>>(
    Object.fromEntries(members.map((m) => [m.id, null]))
  );
  const [isPending, startTransition] = useTransition();

  function cycle(id: string) {
    setAssignments((prev) => {
      const cur = prev[id];
      const next = cur === null ? "A" : cur === "A" ? "B" : null;
      return { ...prev, [id]: next };
    });
  }

  const teamA = members.filter((m) => assignments[m.id] === "A");
  const teamB = members.filter((m) => assignments[m.id] === "B");
  const canSubmit = teamA.length >= 1 && teamB.length >= 1;

  function handleSubmit() {
    const lineups = members
      .filter((m) => assignments[m.id] !== null)
      .map((m) => ({ member_id: m.id, team: assignments[m.id] as "A" | "B" }));
    startTransition(async () => {
      const result = await createMatch(eventId, lineups);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          タップでA→B→未割当と切り替えます
        </p>
        <ul className="space-y-2">
          {members.map((m) => {
            const team = assignments[m.id];
            return (
              <li
                key={m.id}
                onClick={() => cycle(m.id)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors",
                  team === "A"
                    ? "bg-blue-50 border-blue-300 dark:bg-blue-950"
                    : team === "B"
                    ? "bg-green-50 border-green-300 dark:bg-green-950"
                    : "bg-card"
                )}
              >
                <span className="font-medium">{m.name}</span>
                {team ? (
                  <Badge
                    className={cn(
                      "font-bold text-base px-3",
                      team === "A"
                        ? "bg-blue-500 hover:bg-blue-500"
                        : "bg-green-500 hover:bg-green-500"
                    )}
                  >
                    {team}チーム
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">未割当</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* プレビュー */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200">
          <p className="font-bold text-blue-700 dark:text-blue-300 mb-1">Aチーム</p>
          {teamA.length === 0 ? (
            <p className="text-muted-foreground">未選択</p>
          ) : (
            teamA.map((m) => <p key={m.id}>{m.name}</p>)
          )}
        </div>
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200">
          <p className="font-bold text-green-700 dark:text-green-300 mb-1">Bチーム</p>
          {teamB.length === 0 ? (
            <p className="text-muted-foreground">未選択</p>
          ) : (
            teamB.map((m) => <p key={m.id}>{m.name}</p>)
          )}
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || isPending}
        className="w-full"
        size="lg"
      >
        {isPending ? "作成中..." : "試合を開始する"}
      </Button>
    </div>
  );
}
