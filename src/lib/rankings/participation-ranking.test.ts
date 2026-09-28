import { describe, expect, it } from "vitest";

import type { RankingRow } from "@/types";

import { buildRankingRows } from "./participation-ranking";

const rows: RankingRow[] = [
  {
    member_id: "half",
    name: "半分参加",
    total_goals: 10,
    participated_events: 2,
    total_events: 4,
    rank: 1,
  },
  {
    member_id: "full",
    name: "全参加",
    total_goals: 10,
    participated_events: 4,
    total_events: 4,
    rank: 1,
  },
  {
    member_id: "same-adjusted",
    name: "補正同点",
    total_goals: 20,
    participated_events: 1,
    total_events: 4,
    rank: 3,
  },
  {
    member_id: "no-events",
    name: "参加なし",
    total_goals: 3,
    participated_events: 0,
    total_events: 0,
    rank: 4,
  },
];

describe("参加率補正ランキング", () => {
  it("総得点に参加率を掛け、同じ総得点なら参加率が高い人を上位にする", () => {
    const ranking = buildRankingRows(rows, "participation");

    expect(ranking.map((row) => row.member_id)).toEqual([
      "full",
      "same-adjusted",
      "half",
      "no-events",
    ]);
    expect(ranking.map((row) => row.adjusted_score)).toEqual([10, 5, 5, 0]);
    expect(ranking.map((row) => row.display_rank)).toEqual([1, 2, 2, 4]);
  });

  it("総得点モードでは従来どおり得点順と同順位を維持する", () => {
    const ranking = buildRankingRows(rows, "goals");

    expect(ranking.map((row) => row.member_id)).toEqual([
      "same-adjusted",
      "half",
      "full",
      "no-events",
    ]);
    expect(ranking.map((row) => row.display_rank)).toEqual([1, 2, 2, 4]);
  });
});
