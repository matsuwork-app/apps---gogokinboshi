import { describe, expect, it } from "vitest";

import { getRouteRedirect } from "./route-access";

const approvedMember = { role: "member" as const, status: "approved" as const };
const approvedAdmin = { role: "admin" as const, status: "approved" as const };
const pendingMember = { role: "member" as const, status: "pending" as const };

describe("Proxyの早期アクセス判定", () => {
  it("legacyモードでは既存ルートを遮断しない", () => {
    expect(getRouteRedirect("/events", "legacy", false, null)).toBeNull();
  });

  it("未ログイン利用者をloginへ送る", () => {
    expect(getRouteRedirect("/events", "line", false, null)).toBe("/login");
    expect(getRouteRedirect("/login", "line", false, null)).toBeNull();
    expect(getRouteRedirect("/auth/callback", "line", false, null)).toBeNull();
  });

  it("未承認利用者はpendingだけを閲覧できる", () => {
    expect(getRouteRedirect("/", "line", true, pendingMember)).toBe("/pending");
    expect(getRouteRedirect("/pending", "line", true, pendingMember)).toBeNull();
  });

  it("承認済み利用者をlogin/pendingからアプリへ戻す", () => {
    expect(getRouteRedirect("/login", "line", true, approvedMember)).toBe("/");
    expect(getRouteRedirect("/pending", "line", true, approvedMember)).toBe("/");
    expect(getRouteRedirect("/events", "line", true, approvedMember)).toBeNull();
  });

  it("承認管理画面は承認済み管理者だけに許可する", () => {
    expect(getRouteRedirect("/admin/access", "line", true, approvedMember)).toBe("/");
    expect(getRouteRedirect("/admin/access", "line", true, approvedAdmin)).toBeNull();
  });
});
