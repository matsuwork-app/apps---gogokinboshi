"use client";

import type { KeyboardEvent } from "react";

import type { RankingMode } from "@/lib/rankings/participation-ranking";
import { cn } from "@/lib/utils";

const OPTIONS: { value: RankingMode; label: string }[] = [
  { value: "goals", label: "総得点" },
  { value: "participation", label: "参加補正" },
];

export default function RankingModeTabs({
  mode,
  onChange,
  compact = false,
}: {
  mode: RankingMode;
  onChange: (mode: RankingMode) => void;
  compact?: boolean;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextMode = mode === "goals" ? "participation" : "goals";
    onChange(nextMode);
    const nextTab = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
      `[data-ranking-mode="${nextMode}"]`,
    );
    nextTab?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="ランキングの集計方法"
      className={cn(
        "grid grid-cols-2 rounded-lg bg-muted p-1",
        compact ? "text-xs" : "text-sm",
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          data-ranking-mode={option.value}
          aria-selected={mode === option.value}
          tabIndex={mode === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "rounded-md px-3 py-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
