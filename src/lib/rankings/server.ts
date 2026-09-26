import "server-only";

import type { RankingRow } from "../../types";
import { isValidDateRange } from "./date-range";
import { createClient } from "../supabase/server";

type RankingRpcRow = {
  member_id: string;
  name: string;
  total_goals: number | string;
  participated_events: number | string;
  total_events: number | string;
  total_seconds: number | string;
  rank: number | string;
};

type RankingRpc = (
  functionName: "get_public_rankings",
  args: { p_from_date: string; p_to_date: string }
) => Promise<{
  data: RankingRpcRow[] | null;
  error: { message: string } | null;
}>;

export class RankingQueryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RankingQueryError";
  }
}

function toFiniteNumber(value: number | string, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new RankingQueryError(`ランキング集計の${field}が不正です`);
  }
  return number;
}

function normalizeRow(row: RankingRpcRow): RankingRow {
  if (!row.member_id || typeof row.name !== "string") {
    throw new RankingQueryError("ランキング集計の応答形式が不正です");
  }
  return {
    member_id: row.member_id,
    name: row.name,
    total_goals: toFiniteNumber(row.total_goals, "得点数"),
    participated_events: toFiniteNumber(row.participated_events, "参加回数"),
    total_events: toFiniteNumber(row.total_events, "イベント数"),
    total_seconds: toFiniteNumber(row.total_seconds, "出場時間"),
    rank: toFiniteNumber(row.rank, "順位"),
  };
}

export async function getPublicRankings(from: string, to: string): Promise<RankingRow[]> {
  if (!isValidDateRange(from, to)) {
    throw new RangeError("期間を正しく指定してください");
  }

  const supabase = await createClient();
  const rpc = supabase.rpc as unknown as RankingRpc;
  const { data, error } = await rpc("get_public_rankings", {
    p_from_date: from,
    p_to_date: to,
  });

  if (error) {
    throw new RankingQueryError("ランキングの取得に失敗しました", { cause: error });
  }
  if (!Array.isArray(data)) {
    throw new RankingQueryError("ランキング集計の応答形式が不正です");
  }

  return data.map(normalizeRow);
}
