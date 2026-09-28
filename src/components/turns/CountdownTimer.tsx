"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  COUNTDOWN_PRESETS,
  formatCountdown,
  getRemainingSeconds,
  minutesToSeconds,
} from "@/lib/turns/countdown";
import { cn } from "@/lib/utils";

export default function CountdownTimer() {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(7);
  const [remainingSeconds, setRemainingSeconds] = useState(
    minutesToSeconds(selectedMinutes)
  );
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);

  const isRunning = deadlineMs !== null;

  useEffect(() => {
    if (deadlineMs === null) return;

    const update = () => {
      const nextRemaining = getRemainingSeconds(deadlineMs, Date.now());
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) setDeadlineMs(null);
    };

    update();
    const intervalId = window.setInterval(update, 250);
    return () => window.clearInterval(intervalId);
  }, [deadlineMs]);

  function selectPreset(minutes: number) {
    setSelectedMinutes(minutes);
    setRemainingSeconds(minutesToSeconds(minutes));
    setDeadlineMs(null);
  }

  function start() {
    if (remainingSeconds === 0) {
      setRemainingSeconds(minutesToSeconds(selectedMinutes));
      setDeadlineMs(Date.now() + minutesToSeconds(selectedMinutes) * 1000);
      return;
    }
    setDeadlineMs(Date.now() + remainingSeconds * 1000);
  }

  function pause() {
    if (deadlineMs === null) return;
    setRemainingSeconds(getRemainingSeconds(deadlineMs, Date.now()));
    setDeadlineMs(null);
  }

  function reset() {
    setDeadlineMs(null);
    setRemainingSeconds(minutesToSeconds(selectedMinutes));
  }

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="countdown-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="countdown-heading" className="font-semibold">
          カウントダウン
        </h2>
        <div className="flex gap-1" aria-label="時間プリセット">
          {COUNTDOWN_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={selectedMinutes === minutes}
              onClick={() => selectPreset(minutes)}
              className={cn(
                "min-h-9 rounded-lg border px-3 text-sm font-medium",
                selectedMinutes === minutes
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background"
              )}
            >
              {minutes}分
            </button>
          ))}
        </div>
      </div>

      <p
        className="my-4 text-center font-mono text-5xl font-bold tabular-nums"
        role="timer"
        aria-label={`残り時間 ${formatCountdown(remainingSeconds)}`}
      >
        {formatCountdown(remainingSeconds)}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {isRunning ? (
          <Button type="button" onClick={pause} size="lg">
            <Pause data-icon="inline-start" />
            一時停止
          </Button>
        ) : (
          <Button type="button" onClick={start} size="lg">
            <Play data-icon="inline-start" />
            開始
          </Button>
        )}
        <Button type="button" onClick={reset} variant="outline" size="lg">
          <RotateCcw data-icon="inline-start" />
          リセット
        </Button>
      </div>
    </section>
  );
}
