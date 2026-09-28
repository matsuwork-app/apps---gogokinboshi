import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManagerSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./session", () => ({
  requireManagerSession: mocks.requireManagerSession,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { requireApprovedUser } from "./users";

describe("認可DALのlegacy安全弁", () => {
  const originalAccessMode = process.env.ACCESS_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCESS_MODE = "legacy";
  });

  afterEach(() => {
    if (originalAccessMode === undefined) delete process.env.ACCESS_MODE;
    else process.env.ACCESS_MODE = originalAccessMode;
  });

  it("legacyモードでも既存の管理者セッションを必須にする", async () => {
    mocks.requireManagerSession.mockResolvedValue(undefined);

    await expect(requireApprovedUser()).resolves.toMatchObject({
      role: "admin",
      status: "approved",
    });
    expect(mocks.requireManagerSession).toHaveBeenCalledOnce();
  });

  it("管理者セッションが無ければlegacyモードの書き込みを拒否する", async () => {
    mocks.requireManagerSession.mockRejectedValue(new Error("管理者セッションが必要です"));

    await expect(requireApprovedUser()).rejects.toThrow("管理者セッションが必要です");
  });
});
