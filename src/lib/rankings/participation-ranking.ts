import type { RankingRow } from "@/types";

export type RankingMode = "goals" | "participation";

export type RankingViewRow = RankingRow & {
  adjusted_score: number;
  display_rank: number;
  participation_rate: number;
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function getParticipationRate(row: RankingRow): number {
  if (row.total_events <= 0) return 0;
  return row.participated_events / row.total_events;
}

export function buildRankingRows(
  rows: RankingRow[],
  mode: RankingMode,
): RankingViewRow[] {
  const ranked = rows.map((row, sourceIndex) => {
    const participationRate = getParticipationRate(row);
    return {
      ...row,
      adjusted_score: roundToOneDecimal(row.total_goals * participationRate),
      display_rank: 0,
      participation_rate: participationRate,
      sourceIndex,
    };
  });

  ranked.sort((a, b) => {
    const aScore = mode === "goals" ? a.total_goals : a.adjusted_score;
    const bScore = mode === "goals" ? b.total_goals : b.adjusted_score;

    if (bScore !== aScore) return bScore - aScore;
    if (mode === "goals") return a.sourceIndex - b.sourceIndex;

    return (
      b.total_goals - a.total_goals ||
      b.participation_rate - a.participation_rate ||
      a.sourceIndex - b.sourceIndex
    );
  });

  let previousScore: number | null = null;
  let currentRank = 0;

  return ranked.map(({ sourceIndex: _sourceIndex, ...row }, index) => {
    const score = mode === "goals" ? row.total_goals : row.adjusted_score;
    if (previousScore === null || score !== previousScore) {
      currentRank = index + 1;
      previousScore = score;
    }

    return { ...row, display_rank: currentRank };
  });
}
