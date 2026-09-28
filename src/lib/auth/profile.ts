import type { AppUserRole, AppUserStatus } from "./access";

type IdentityLike = {
  provider?: string;
  identity_data?: Record<string, unknown> | null;
};

type AuthUserLike = {
  id: string;
  identities?: IdentityLike[] | null;
  user_metadata?: Record<string, unknown> | null;
};

export type LineProfile = {
  authUserId: string;
  lineUserId: string;
  displayName: string;
  avatarUrl: string | null;
};

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalHttpUrl(value: unknown): string | null {
  const candidate = optionalString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? candidate : null;
  } catch {
    return null;
  }
}

export function extractLineProfile(user: AuthUserLike): LineProfile {
  const identity = user.identities?.find(
    (candidate) =>
      candidate.provider === "custom:line-oauth" ||
      candidate.provider === "custom:line",
  );

  if (!identity) {
    throw new Error("LINE identityが見つかりません");
  }

  const claims = identity.identity_data ?? {};
  const metadata = user.user_metadata ?? {};
  const lineUserId = optionalString(claims.sub) ?? optionalString(metadata.sub);

  if (!lineUserId) {
    throw new Error("LINE identityのsubが見つかりません");
  }

  return {
    authUserId: user.id,
    lineUserId,
    displayName:
      optionalString(claims.name) ?? optionalString(metadata.name) ?? "LINEユーザー",
    avatarUrl:
      optionalHttpUrl(claims.picture) ?? optionalHttpUrl(metadata.picture),
  };
}

export function resolvePersistedAccess(
  currentRole: AppUserRole | null,
  currentStatus: AppUserStatus | null,
  isConfiguredAdmin: boolean,
): { role: AppUserRole; status: AppUserStatus } {
  if (isConfiguredAdmin) {
    return { role: "admin", status: "approved" };
  }

  return {
    role: "member",
    status: currentStatus ?? "pending",
  };
}
