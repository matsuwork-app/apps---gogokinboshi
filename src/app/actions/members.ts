"use server";

import { requireManagerSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function addMember(formData: FormData) {
  await requireManagerSession();
  const name = formData.get("name")?.toString().trim();
  if (!name) return { error: "名前を入力してください" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("members").insert({ name });
  if (error) return { error: error.message };

  revalidatePath("/members");
  return { error: null };
}

export async function deleteMember(id: string) {
  await requireManagerSession();
  const supabase = createAdminClient();
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/members");
  return { error: null };
}
