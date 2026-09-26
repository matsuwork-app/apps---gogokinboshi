"use server";

import { setManagerSession } from "@/lib/auth/session";
import { verifyManagerPassword } from "@/lib/auth/crypto";

export type UnlockManagerResult =
  | { ok: true }
  | { ok: false; error: string };

export async function unlockManager(password: string): Promise<UnlockManagerResult> {
  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    return { ok: false, error: "パスコードを入力してください" };
  }

  const passwordHash = process.env.MANAGER_PASSWORD_HASH;
  if (!passwordHash) {
    console.error("MANAGER_PASSWORD_HASH is not configured");
    return { ok: false, error: "管理機能の設定に問題があります" };
  }

  if (!(await verifyManagerPassword(password, passwordHash))) {
    return { ok: false, error: "パスコードが違います" };
  }

  try {
    await setManagerSession();
    return { ok: true };
  } catch (error) {
    console.error("Failed to create manager session", error);
    return { ok: false, error: "管理機能の設定に問題があります" };
  }
}
