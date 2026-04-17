import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RankingRow } from "@/types";

export default function RankingTable({
  ranking,
  formatSeconds,
}: {
  ranking: RankingRow[];
  formatSeconds: (s: number) => string;
}) {
  if (ranking.every((r) => r.total_goals === 0)) {
    return (
      <p className="text-muted-foreground text-center py-8">
        この期間の得点データがありません。
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">順位</TableHead>
            <TableHead>名前</TableHead>
            <TableHead className="text-right">得点</TableHead>
            <TableHead className="text-right">参加率</TableHead>
            <TableHead className="text-right">出場時間</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranking.map((row) => (
            <TableRow key={row.member_id}>
              <TableCell className="text-center">
                {row.rank === 1 ? (
                  <Badge className="bg-yellow-400 text-yellow-900 font-bold">
                    🥇 1
                  </Badge>
                ) : row.rank === 2 ? (
                  <Badge className="bg-slate-300 text-slate-800 font-bold">
                    🥈 2
                  </Badge>
                ) : row.rank === 3 ? (
                  <Badge className="bg-amber-600 text-white font-bold">
                    🥉 3
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">{row.rank}</span>
                )}
              </TableCell>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-right font-bold text-lg">
                {row.total_goals}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {row.total_events > 0
                  ? `${Math.round((row.participated_events / row.total_events) * 100)}%`
                  : "-"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {row.total_seconds > 0 ? formatSeconds(row.total_seconds) : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
