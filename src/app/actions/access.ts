"use server";

import { revalidatePath } from "next/cache";

import { setAppUserStatus } from "@/lib/auth/users";
import type { AppUserStatus } from "@/lib/auth/access";

export async function changeAppUserStatus(formData: FormData): Promise<void> {
  const appUserId = formData.get("app_user_id");
  const status = formData.get("status");
  if (typeof appUserId !== "string" || !appUserId) {
    throw new Error("利用者が指定されていません");
  }
  if (status !== "approved" && status !== "revoked") {
    throw new Error("変更できない利用状態です");
  }

  await setAppUserStatus(appUserId, status satisfies AppUserStatus);
  revalidatePath("/admin/access");
}
