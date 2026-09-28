export type AccessMode = "legacy" | "line";
export type AppUserRole = "admin" | "member";
export type AppUserStatus = "pending" | "approved" | "revoked";

export type AppUserAccess = {
  role: AppUserRole;
  status: AppUserStatus;
};

export function getAccessMode(value = process.env.ACCESS_MODE): AccessMode {
  return value === "legacy" ? "legacy" : "line";
}

export function getInitialAccess(
  lineUserId: string,
  adminLineUserId = process.env.LINE_ADMIN_USER_ID,
): AppUserAccess {
  return adminLineUserId && lineUserId === adminLineUserId
    ? { role: "admin", status: "approved" }
    : { role: "member", status: "pending" };
}

export function hasApprovedAccess(user: AppUserAccess | null): boolean {
  return user?.status === "approved";
}

export function hasAdminAccess(user: AppUserAccess | null): boolean {
  return user?.status === "approved" && user.role === "admin";
}

export function getAppUserDestination(user: AppUserAccess | null): string {
  if (!user) return "/login";
  return hasApprovedAccess(user) ? "/" : "/pending";
}
