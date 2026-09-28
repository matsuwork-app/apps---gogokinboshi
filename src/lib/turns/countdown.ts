export const COUNTDOWN_PRESETS = [5, 7, 10] as const;

export function minutesToSeconds(minutes: number) {
  return minutes * 60;
}

export function getRemainingSeconds(deadlineMs: number, nowMs: number) {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}
