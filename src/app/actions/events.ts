"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireApprovedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type TeamAssignment = {
  member_id: string;
  position: number;
};

export type EventTeamReassignment = {
  member_id: string;
  event_team_id: string;
};

function parseTeamAssignments(value: FormDataEntryValue | null): TeamAssignment[] | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const assignments = parsed.map((item) => {
      if (!item || typeof item !== "object") throw new Error("invalid assignment");
      const memberId = Reflect.get(item, "member_id");
      const position = Reflect.get(item, "position");
      if (typeof memberId !== "string" || !Number.isInteger(position)) {
        throw new Error("invalid assignment");
      }
      return { member_id: memberId, position: Number(position) };
    });
    return assignments;
  } catch {
    return null;
  }
}

export async function createEvent(formData: FormData) {
  await requireApprovedUser();
  const eventDate = formData.get("event_date")?.toString();
  const notes = formData.get("notes")?.toString() || "";
  const teamCount = Number(formData.get("team_count"));
  const assignments = parseTeamAssignments(formData.get("team_assignments"));

  if (!eventDate) return { error: "日付を選択してください" };
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 4) {
    return { error: "チーム数は2〜4から選択してください" };
  }
  if (!assignments || assignments.length < teamCount) {
    return { error: "すべての参加メンバーをチームへ割り当ててください" };
  }
  if (new Set(assignments.map(({ member_id }) => member_id)).size !== assignments.length) {
    return { error: "同じメンバーを複数チームへ割り当てることはできません" };
  }

  const teams = Array.from({ length: teamCount }, (_, index) => ({
    name: `チーム${String.fromCharCode(65 + index)}`,
    member_ids: assignments
      .filter(({ position }) => position === index + 1)
      .map(({ member_id }) => member_id),
  }));
  if (teams.some(({ member_ids }) => member_ids.length === 0)) {
    return { error: "各チームに1名以上割り当ててください" };
  }
  if (assignments.some(({ position }) => position < 1 || position > teamCount)) {
    return { error: "不正なチーム割り当てが含まれています" };
  }

  const supabase = createAdminClient();
  const { data: eventId, error } = await supabase.rpc("create_event_with_teams", {
    p_event_date: eventDate,
    p_notes: notes,
    p_teams: teams,
  });

  if (error || !eventId) return { error: error?.message ?? "イベント作成に失敗しました" };

  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function deleteEvent(id: string) {
  await requireApprovedUser();
  const supabase = createAdminClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { error: null };
}

function parseEventTeamReassignments(
  value: unknown,
): EventTeamReassignment[] | null {
  if (!Array.isArray(value)) return null;

  const assignments: EventTeamReassignment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const memberId = Reflect.get(item, "member_id");
    const eventTeamId = Reflect.get(item, "event_team_id");
    if (
      typeof memberId !== "string" ||
      memberId.trim().length === 0 ||
      typeof eventTeamId !== "string" ||
      eventTeamId.trim().length === 0
    ) {
      return null;
    }
    assignments.push({ member_id: memberId, event_team_id: eventTeamId });
  }

  return assignments;
}

export async function createEventTurn(
  eventId: string,
  input: unknown,
) {
  await requireApprovedUser();

  if (typeof eventId !== "string" || eventId.trim().length === 0) {
    return { error: "イベントが指定されていません" };
  }

  const assignments = parseEventTeamReassignments(input);
  if (!assignments || assignments.length < 2) {
    return { error: "すべての参加者をチームへ割り当ててください" };
  }

  if (
    new Set(assignments.map(({ member_id }) => member_id)).size !==
    assignments.length
  ) {
    return { error: "同じ参加者を複数チームへ割り当てることはできません" };
  }

  const teamCount = new Set(
    assignments.map(({ event_team_id }) => event_team_id),
  ).size;
  if (teamCount < 2 || teamCount > 4) {
    return { error: "2〜4チームすべてに1名以上割り当ててください" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_event_turn", {
    p_event_id: eventId,
    p_assignments: assignments,
  });

  if (error) return { error: error.message };
  const turn = Array.isArray(data) ? data[0] : null;
  if (!turn?.turn_id || !Number.isInteger(turn.turn_number)) {
    return { error: "新しいターンを作成できませんでした" };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/teams/edit`);
  revalidatePath(`/events/${eventId}/turns/${turn.turn_id}`);
  return {
    error: null,
    turnId: turn.turn_id,
    turnNumber: turn.turn_number,
  };
}
