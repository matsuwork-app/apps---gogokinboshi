"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createEvent(formData: FormData) {
  const eventDate = formData.get("event_date")?.toString();
  const notes = formData.get("notes")?.toString() || null;
  const memberIds = formData.getAll("member_ids").map(String);

  if (!eventDate) return { error: "日付を選択してください" };
  if (memberIds.length < 2) return { error: "参加メンバーを2名以上選択してください" };

  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({ event_date: eventDate, notes })
    .select()
    .single();

  if (eventError || !event) return { error: eventError?.message ?? "作成失敗" };

  const participants = memberIds.map((member_id) => ({
    event_id: event.id,
    member_id,
  }));
  const { error: pError } = await supabase
    .from("event_participants")
    .insert(participants);
  if (pError) return { error: pError.message };

  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { error: null };
}
