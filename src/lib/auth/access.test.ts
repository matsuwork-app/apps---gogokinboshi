import { describe, expect, it } from "vitest";

import {
  getAccessMode,
  getAppUserDestination,
  getInitialAccess,
  hasAdminAccess,
  hasApprovedAccess,
} from "./access";

describe("LINE認証のアクセス判定", () => {
  it("明示したlegacy以外は安全側のLINE認証を有効にする", () => {
    expect(getAccessMode(undefined)).toBe("line");
    expect(getAccessMode("")).toBe("line");
    expect(getAccessMode("legacy")).toBe("legacy");
    expect(getAccessMode("LINE")).toBe("line");
    expect(getAccessMode("line")).toBe("line");
  });

  it("環境変数と一致するLINEユーザーだけを承認済み管理者にする", () => {
    expect(getInitialAccess("line-admin", "line-admin")).toEqual({
      role: "admin",
      status: "approved",
    });
    expect(getInitialAccess("line-member", "line-admin")).toEqual({
      role: "member",
      status: "pending",
    });
    expect(getInitialAccess("line-member", undefined)).toEqual({
      role: "member",
      status: "pending",
    });
  });

  it("approvedだけがアプリを利用でき、adminかつapprovedだけが承認管理できる", () => {
    expect(hasApprovedAccess({ role: "member", status: "approved" })).toBe(true);
    expect(hasApprovedAccess({ role: "admin", status: "pending" })).toBe(false);
    expect(hasApprovedAccess({ role: "member", status: "revoked" })).toBe(false);
    expect(hasAdminAccess({ role: "admin", status: "approved" })).toBe(true);
    expect(hasAdminAccess({ role: "member", status: "approved" })).toBe(false);
  });

  it("ログイン後の状態に応じて遷移先を分ける", () => {
    expect(getAppUserDestination(null)).toBe("/login");
    expect(getAppUserDestination({ role: "member", status: "pending" })).toBe(
      "/pending",
    );
    expect(getAppUserDestination({ role: "member", status: "revoked" })).toBe(
      "/pending",
    );
    expect(getAppUserDestination({ role: "member", status: "approved" })).toBe("/");
  });
});
