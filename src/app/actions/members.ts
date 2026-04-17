"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addMember(formData: FormData) {
  const name = formData.get("name")?.toString().trim();
  if (!name) return { error: "名前を入力してください" };

  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({ name });
  if (error) return { error: error.message };

  revalidatePath("/members");
  return { error: null };
}

export async function deleteMember(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/members");
  return { error: null };
}
