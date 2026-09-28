import "server-only";

import type { User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import {
  getAccessMode,
  hasAdminAccess,
  hasApprovedAccess,
  type AppUserRole,
  type AppUserStatus,
} from "./access";
import { extractLineProfile, resolvePersistedAccess } from "./profile";
import { requireManagerSession } from "./session";

export type AppUser = {
  id: string;
  authUserId: string;
  lineUserId: string;
  displayName: string;
  avatarUrl: string | null;
  role: AppUserRole;
  status: AppUserStatus;
  createdAt: string;
  updatedAt: string;
};

type AppUserRow = Database["public"]["Tables"]["app_users"]["Row"];

const APP_USER_COLUMNS =
  "id, auth_user_id, line_user_id, display_name, avatar_url, role, status, created_at, updated_at";

const legacyUser: AppUser = {
  id: "legacy",
  authUserId: "legacy",
  lineUserId: "legacy",
  displayName: "管理者",
  avatarUrl: null,
  role: "admin",
  status: "approved",
  createdAt: "",
  updatedAt: "",
};

function toAppUser(row: AppUserRow): AppUser {
  if (row.role !== "admin" && row.role !== "member") {
    throw new Error("利用者に不正な権限が設定されています");
  }
  if (
    row.status !== "pending" &&
    row.status !== "approved" &&
    row.status !== "revoked"
  ) {
    throw new Error("利用者に不正な状態が設定されています");
  }

  const role =
    row.role === "admin" && row.line_user_id !== process.env.LINE_ADMIN_USER_ID
      ? "member"
      : row.role;

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentAuthUser(): Promise<User | null> {
  if (getAccessMode() === "legacy") return null;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return null;
  return user;
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  if (getAccessMode() === "legacy") return legacyUser;

  const authUser = await getCurrentAuthUser();
  if (!authUser) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(`利用者情報の取得に失敗しました: ${error.message}`);
  }

  if (!data) return syncAppUserFromLine(authUser);
  if (
    data.line_user_id === process.env.LINE_ADMIN_USER_ID &&
    (data.role !== "admin" || data.status !== "approved")
  ) {
    return syncAppUserFromLine(authUser);
  }
  return toAppUser(data);
}

export async function syncAppUserFromLine(authUser: User): Promise<AppUser> {
  const profile = extractLineProfile(authUser);
  const adminLineUserId = process.env.LINE_ADMIN_USER_ID;
  const isConfiguredAdmin = Boolean(
    adminLineUserId && profile.lineUserId === adminLineUserId,
  );
  const supabase = createAdminClient();

  const { data: current, error: findError } = await supabase
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .eq("auth_user_id", profile.authUserId)
    .maybeSingle();

  if (findError) {
    throw new Error(`利用者情報の確認に失敗しました: ${findError.message}`);
  }

  const access = resolvePersistedAccess(
    current?.role === "admin" || current?.role === "member" ? current.role : null,
    current?.status === "pending" ||
      current?.status === "approved" ||
      current?.status === "revoked"
      ? current.status
      : null,
    isConfiguredAdmin,
  );
  const values = {
    auth_user_id: profile.authUserId,
    line_user_id: profile.lineUserId,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
    role: access.role,
    status: access.status,
  };

  const query = current
    ? supabase
        .from("app_users")
        .update(values)
        .eq("id", current.id)
    : supabase.from("app_users").insert(values);
  const { data, error } = await query.select(APP_USER_COLUMNS).single();

  if (error || !data) {
    throw new Error(`利用者情報の保存に失敗しました: ${error?.message ?? "unknown"}`);
  }

  return toAppUser(data);
}

export async function requireApprovedUser(): Promise<AppUser> {
  if (getAccessMode() === "legacy") {
    await requireManagerSession();
    return legacyUser;
  }

  const user = await getCurrentAppUser();
  if (!user) throw new Error("ログインが必要です");
  if (!hasApprovedAccess(user)) throw new Error("利用承認が必要です");
  return user;
}

export async function requireAdminUser(): Promise<AppUser> {
  const user = await requireApprovedUser();
  if (getAccessMode() === "legacy") return user;

  if (
    !hasAdminAccess(user) ||
    !process.env.LINE_ADMIN_USER_ID ||
    user.lineUserId !== process.env.LINE_ADMIN_USER_ID
  ) {
    throw new Error("管理者権限が必要です");
  }
  return user;
}

export async function listAppUsers(): Promise<AppUser[]> {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`利用者一覧の取得に失敗しました: ${error.message}`);
  return (data ?? []).map(toAppUser);
}

export async function setAppUserStatus(
  appUserId: string,
  status: AppUserStatus,
): Promise<void> {
  await requireAdminUser();
  if (status !== "approved" && status !== "revoked") {
    throw new Error("変更できない利用状態です");
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("app_users")
    .update({ status, role: "member" })
    .eq("id", appUserId);

  const adminLineUserId = process.env.LINE_ADMIN_USER_ID;
  if (adminLineUserId) query = query.neq("line_user_id", adminLineUserId);

  const { error } = await query;
  if (error) throw new Error(`利用状態の変更に失敗しました: ${error.message}`);
}
