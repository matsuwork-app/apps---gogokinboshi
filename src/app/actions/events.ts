"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManagerSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type TeamAssignment = {
  member_id: string;
  position: number;
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
  await requireManagerSession();
  const eventDate = formData.get("event_date")?.toString();
  const notes = formData.get("notes")?.toString() || null;
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
  await requireManagerSession();
  const supabase = createAdminClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { error: null };
}
