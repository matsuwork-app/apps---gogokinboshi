"use client";

import { useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import RankingModeTabs from "@/components/RankingModeTabs";
import {
  buildRankingRows,
  type RankingMode,
} from "@/lib/rankings/participation-ranking";
import type { RankingRow } from "@/types";

export default function RankingTable({
  ranking,
}: {
  ranking: RankingRow[];
}) {
  const [mode, setMode] = useState<RankingMode>("goals");
  const rows = useMemo(() => buildRankingRows(ranking, mode), [ranking, mode]);

  if (ranking.every((r) => r.total_goals === 0)) {
    return (
      <p className="text-muted-foreground text-center py-8">
        この期間の得点データがありません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <RankingModeTabs mode={mode} onChange={setMode} />
      {mode === "participation" && (
        <p className="text-muted-foreground text-xs text-center">
          補正得点 ＝ 総得点 × 参加率
        </p>
      )}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">順位</TableHead>
              <TableHead>名前</TableHead>
              <TableHead className="text-right">
                {mode === "goals" ? "得点" : "補正得点"}
              </TableHead>
              {mode === "participation" && (
                <TableHead className="text-right">得点</TableHead>
              )}
              <TableHead className="text-right">参加率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.member_id}>
                <TableCell className="text-center">
                  {row.display_rank === 1 ? (
                    <Badge className="bg-yellow-400 text-yellow-900 font-bold">
                      🥇 1
                    </Badge>
                  ) : row.display_rank === 2 ? (
                    <Badge className="bg-slate-300 text-slate-800 font-bold">
                      🥈 2
                    </Badge>
                  ) : row.display_rank === 3 ? (
                    <Badge className="bg-amber-600 text-white font-bold">
                      🥉 3
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      {row.display_rank}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right font-bold text-lg">
                  {mode === "goals"
                    ? row.total_goals
                    : row.adjusted_score.toFixed(1)}
                </TableCell>
                {mode === "participation" && (
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {row.total_goals}
                  </TableCell>
                )}
                <TableCell className="text-right text-muted-foreground text-sm">
                  {row.total_events > 0
                    ? `${Math.round(row.participation_rate * 100)}%`
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
