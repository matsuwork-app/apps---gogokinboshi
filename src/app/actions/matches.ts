"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManagerSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Match } from "@/types";

type ActionError = { error: string };

async function resolveMatchEventId(
  supabase: ReturnType<typeof createAdminClient>,
  matchId: string
): Promise<{ eventId?: string; error?: string }> {
  const { data, error } = await supabase
    .from("matches")
    .select("event_id")
    .eq("id", matchId)
    .single();

  if (error || !data) {
    return { error: error?.message ?? "試合が見つかりません" };
  }
  return { eventId: data.event_id };
}

function revalidateGoalPaths(eventId: string, matchId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/matches/${matchId}`);
  revalidatePath("/");
}

export async function createMatch(
  eventId: string,
  firstTeamId: string,
  secondTeamId: string
): Promise<ActionError | never> {
  await requireManagerSession();
  if (!eventId || !firstTeamId || !secondTeamId) {
    return { error: "対戦する2チームを選択してください" };
  }
  if (firstTeamId === secondTeamId) {
    return { error: "異なる2チームを選択してください" };
  }

  const supabase = createAdminClient();
  const { data: matchId, error } = await supabase.rpc("create_match_with_teams", {
    p_event_id: eventId,
    p_event_team_ids: [firstTeamId, secondTeamId],
  });

  if (error || !matchId) return { error: error?.message ?? "試合作成に失敗しました" };

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}/matches/${matchId}`);
}

export async function transitionMatch(
  eventId: string,
  matchId: string,
  expectedStatus: Match["status"],
  nextStatus: Match["status"]
): Promise<{ data?: Match; error?: string }> {
  await requireManagerSession();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("transition_match", {
    p_match_id: matchId,
    p_expected_status: expectedStatus,
    p_next_status: nextStatus,
  });

  if (error) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/matches/${matchId}`);
  return { data };
}

export async function setPlayerPlaying(
  matchId: string,
  memberId: string,
  isPlaying: boolean
): Promise<ActionError | { error: null }> {
  await requireManagerSession();
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("set_player_playing", {
    p_match_id: matchId,
    p_member_id: memberId,
    p_is_playing: isPlaying,
  });
  return { error: error?.message ?? null };
}

export async function addGoal(
  matchId: string,
  memberId: string
): Promise<{ id?: string; error?: string }> {
  await requireManagerSession();
  const supabase = createAdminClient();
  const match = await resolveMatchEventId(supabase, matchId);
  if (match.error || !match.eventId) {
    return { error: match.error ?? "試合が見つかりません" };
  }
  const { data, error } = await supabase
    .from("goals")
    .insert({ match_id: matchId, member_id: memberId })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateGoalPaths(match.eventId, matchId);
  return { id: data.id };
}

export async function removeGoal(
  matchId: string,
  memberId: string,
  goalId: string
): Promise<ActionError | { error: null }> {
  await requireManagerSession();
  const supabase = createAdminClient();
  const match = await resolveMatchEventId(supabase, matchId);
  if (match.error || !match.eventId) {
    return { error: match.error ?? "試合が見つかりません" };
  }
  const { data, error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("match_id", matchId)
    .eq("member_id", memberId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return { error: "得点が見つかりません。画面を更新してください" };
  }
  revalidateGoalPaths(match.eventId, matchId);
  return { error: null };
}
