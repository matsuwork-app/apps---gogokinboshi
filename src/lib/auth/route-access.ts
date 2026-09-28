import {
  hasAdminAccess,
  hasApprovedAccess,
  type AccessMode,
  type AppUserAccess,
} from "./access";

export function getRouteRedirect(
  pathname: string,
  mode: AccessMode,
  isAuthenticated: boolean,
  appUser: AppUserAccess | null,
): string | null {
  if (mode === "legacy" || pathname.startsWith("/auth/callback")) return null;

  if (!isAuthenticated) {
    return pathname === "/login" ? null : "/login";
  }

  if (!appUser || !hasApprovedAccess(appUser)) {
    return pathname === "/pending" ? null : "/pending";
  }

  if (pathname === "/login" || pathname === "/pending") return "/";
  if (pathname.startsWith("/admin/access") && !hasAdminAccess(appUser)) return "/";
  return null;
}
