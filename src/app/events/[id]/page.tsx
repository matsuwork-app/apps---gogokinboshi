import Link from "next/link";
import { notFound } from "next/navigation";
import { History, UsersRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type TurnRow = { id: string; turn_number: number; created_at: string };
type LegacyMatchRow = { id: string; match_number: number };

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [eventResult, turnsResult, participantsResult, legacyMatchesResult] =
    await Promise.all([
      supabase.from("events").select("id,event_date,notes").eq("id", id).single(),
      supabase
        .from("event_turns")
        .select("id,turn_number,created_at")
        .eq("event_id", id)
        .order("turn_number", { ascending: false }),
      supabase
        .from("event_participants")
        .select("members(id,name)")
        .eq("event_id", id),
      supabase
        .from("matches")
        .select("id,match_number")
        .eq("event_id", id)
        .order("match_number"),
    ]);

  if (!eventResult.data) notFound();
  const loadError = [
    turnsResult.error,
    participantsResult.error,
    legacyMatchesResult.error,
  ].find(Boolean);
  if (loadError) {
    throw new Error("イベントデータの読み込みに失敗しました", { cause: loadError });
  }

  const event = eventResult.data;
  const turns = (turnsResult.data ?? []) as TurnRow[];
  const latestTurn = turns[0];
  const legacyMatches = (legacyMatchesResult.data ?? []) as LegacyMatchRow[];
  const memberNames = (participantsResult.data ?? []).flatMap(({ members }) => {
    const member = Array.isArray(members) ? members[0] : members;
    return member?.name ? [member.name] : [];
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">
          {new Date(event.event_date).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
            timeZone: "Asia/Tokyo",
          })}
        </h1>
        {event.notes && <p className="mt-1 text-muted-foreground">{event.notes}</p>}
        <p className="mt-1 text-sm text-muted-foreground">
          参加: {memberNames.join("、")}
        </p>
      </header>

      {latestTurn ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">現在のチーム編成</p>
          <h2 className="mt-1 text-xl font-bold">第{latestTurn.turn_number}ターン</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            全チームの得点入力とターン用タイマーを同じ画面で操作できます。
          </p>
          <Link
            href={`/events/${id}/turns/${latestTurn.id}`}
            className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}
          >
            得点入力を開く
          </Link>
        </section>
      ) : (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          ターンがありません。データ更新後にもう一度開いてください。
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">ターン</h2>
            <p className="text-xs text-muted-foreground">チーム編成を変えた時だけ新しく作成します</p>
          </div>
          <Link
            href={`/events/${id}/teams/edit`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            <UsersRound size={14} className="mr-1" />
            チームを組み替え
          </Link>
        </div>
        <ul className="space-y-2">
          {turns.map((turn, index) => (
            <li key={turn.id}>
              <Link
                href={`/events/${id}/turns/${turn.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
              >
                <span className="font-semibold">第{turn.turn_number}ターン</span>
                <span className="text-sm text-muted-foreground">
                  {index === 0 ? "現在" : "得点を見る"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {legacyMatches.length > 0 && (
        <details className="rounded-lg border bg-muted/20 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <History size={16} />
            以前の試合履歴（{legacyMatches.length}件）
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            旧方式で記録した得点はランキングへ引き続き合算されます。
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {legacyMatches.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/events/${id}/matches/${match.id}`}
                  className="block rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
                >
                  第{match.match_number}試合
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
