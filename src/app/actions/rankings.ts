"use server";

import type { RankingRow } from "../../types";
import { getPublicRankings } from "../../lib/rankings/server";

export type RankingActionResult =
  | { ok: true; ranking: RankingRow[] }
  | { ok: false; error: string };

export async function loadPublicRankings(
  from: string,
  to: string
): Promise<RankingActionResult> {
  try {
    return { ok: true, ranking: await getPublicRankings(from, to) };
  } catch (error) {
    if (error instanceof RangeError) {
      return { ok: false, error: "期間を正しく指定してください" };
    }
    console.error("Failed to load public rankings", error);
    return {
      ok: false,
      error: "ランキングの取得に失敗しました。時間をおいてもう一度お試しください。",
    };
  }
}
