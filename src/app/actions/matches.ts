"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createMatch(
  eventId: string,
  lineups: { member_id: string; team: "A" | "B" }[]
) {
  if (lineups.length < 2) return { error: "最低2名のラインナップが必要です" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("matches")
    .select("match_number")
    .eq("event_id", eventId)
    .order("match_number", { ascending: false })
    .limit(1);

  const matchNumber = (existing?.[0]?.match_number ?? 0) + 1;

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({ event_id: eventId, match_number: matchNumber })
    .select()
    .single();

  if (matchError || !match) return { error: matchError?.message ?? "作成失敗" };

  const { error: lineupError } = await supabase
    .from("match_lineups")
    .insert(lineups.map((l) => ({ ...l, match_id: match.id })));

  if (lineupError) return { error: lineupError.message };

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}/matches/${match.id}`);
}
