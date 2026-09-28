"use server";

import { revalidatePath } from "next/cache";

import { requireApprovedUser } from "@/lib/auth/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { asTurnScoringClient } from "@/lib/turns/database";

type ActionError = { error: string };

async function resolveTurnEventId(
  supabase: ReturnType<typeof asTurnScoringClient>,
  turnId: string
): Promise<{ eventId?: string; error?: string }> {
  const { data, error } = await supabase
    .from("event_turns")
    .select("event_id")
    .eq("id", turnId)
    .single();

  if (error || !data) {
    return { error: error?.message ?? "ターンが見つかりません" };
  }
  return { eventId: data.event_id };
}

function revalidateTurnPaths(eventId: string, turnId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/turns/${turnId}`);
  revalidatePath("/");
}

export async function addTurnGoal(
  turnId: string,
  memberId: string
): Promise<{ id?: string; error?: string }> {
  await requireApprovedUser();
  if (!turnId || !memberId) return { error: "得点対象を特定できません" };

  const supabase = asTurnScoringClient(createAdminClient());
  const turn = await resolveTurnEventId(supabase, turnId);
  if (turn.error || !turn.eventId) {
    return { error: turn.error ?? "ターンが見つかりません" };
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({ event_turn_id: turnId, member_id: memberId })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateTurnPaths(turn.eventId, turnId);
  return { id: data.id };
}

export async function removeTurnGoal(
  turnId: string,
  memberId: string,
  goalId: string
): Promise<ActionError | { error: null }> {
  await requireApprovedUser();
  if (!turnId || !memberId || !goalId) {
    return { error: "取り消す得点を特定できません" };
  }

  const supabase = asTurnScoringClient(createAdminClient());
  const turn = await resolveTurnEventId(supabase, turnId);
  if (turn.error || !turn.eventId) {
    return { error: turn.error ?? "ターンが見つかりません" };
  }

  const { data, error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("event_turn_id", turnId)
    .eq("member_id", memberId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return { error: "得点が見つかりません。画面を更新してください" };
  }

  revalidateTurnPaths(turn.eventId, turnId);
  return { error: null };
}
