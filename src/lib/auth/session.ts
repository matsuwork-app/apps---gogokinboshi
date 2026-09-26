import "server-only";

import { cookies } from "next/headers";

import {
  createManagerSessionToken,
  MANAGER_SESSION_DURATION_SECONDS,
  verifyManagerSessionToken,
} from "./crypto";

export const MANAGER_SESSION_COOKIE = "gogokinboshi_manager_session";

function getSessionSecret(): string {
  const secret = process.env.MANAGER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MANAGER_SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
}

function getOptionalSessionSecret(): string | null {
  const secret = process.env.MANAGER_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export async function setManagerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    MANAGER_SESSION_COOKIE,
    createManagerSessionToken(getSessionSecret()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MANAGER_SESSION_DURATION_SECONDS,
      priority: "high",
    }
  );
}

export async function hasManagerSession(): Promise<boolean> {
  const token = (await cookies()).get(MANAGER_SESSION_COOKIE)?.value;
  const secret = getOptionalSessionSecret();
  return token && secret ? verifyManagerSessionToken(token, secret) : false;
}

export async function requireManagerSession(): Promise<void> {
  if (!(await hasManagerSession())) {
    throw new Error("管理者セッションが必要です");
  }
}
