import "server-only";

import type { RankingRow } from "../../types";
import type { Database } from "../../types/database";
import { isValidDateRange } from "./date-range";
import { createClient } from "../supabase/server";

type RankingRpcRow =
  Database["public"]["Functions"]["get_public_rankings"]["Returns"][number];

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
  const { data, error } = await supabase.rpc("get_public_rankings", {
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
