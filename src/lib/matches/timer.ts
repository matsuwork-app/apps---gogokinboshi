type MatchTimerState = {
  elapsedSeconds: number;
  activeStartedAt: string | null;
  now?: Date;
};

export function calculateElapsedSeconds({
  elapsedSeconds,
  activeStartedAt,
  now = new Date(),
}: MatchTimerState) {
  const savedSeconds = Math.max(0, Math.floor(elapsedSeconds));
  if (!activeStartedAt) return savedSeconds;

  const activeStartedAtMs = new Date(activeStartedAt).getTime();
  if (!Number.isFinite(activeStartedAtMs)) return savedSeconds;

  const activeSeconds = Math.max(
    0,
    Math.floor((now.getTime() - activeStartedAtMs) / 1000)
  );

  return savedSeconds + activeSeconds;
}
