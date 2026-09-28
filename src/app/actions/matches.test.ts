import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminClient: undefined as unknown,
  requireManagerSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireManagerSession: mocks.requireManagerSession,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.adminClient,
}));

import { addGoal, removeGoal } from "./matches";

function createMatchLookup(eventId = "event-1") {
  const single = vi.fn().mockResolvedValue({
    data: { event_id: eventId },
    error: null,
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, single };
}

function expectGoalPathsRevalidated() {
  expect(mocks.revalidatePath.mock.calls).toEqual([
    ["/events/event-1"],
    ["/events/event-1/matches/match-1"],
    ["/"],
  ]);
}

describe("得点Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManagerSession.mockResolvedValue(undefined);
  });

  it("DBから解決したイベントに対して得点追加後の関連画面を再検証する", async () => {
    const matchLookup = createMatchLookup();
    const singleGoal = vi.fn().mockResolvedValue({
      data: { id: "goal-1" },
      error: null,
    });
    const selectGoal = vi.fn(() => ({ single: singleGoal }));
    const insertGoal = vi.fn(() => ({ select: selectGoal }));
    mocks.adminClient = {
      from: vi.fn((table: string) =>
        table === "matches" ? matchLookup : { insert: insertGoal },
      ),
    };

    await expect(addGoal("match-1", "member-1")).resolves.toEqual({
      id: "goal-1",
    });
    expect(matchLookup.eq).toHaveBeenCalledWith("id", "match-1");
    expectGoalPathsRevalidated();
  });

  it("該当得点が0件なら競合エラーを返し再検証しない", async () => {
    const matchLookup = createMatchLookup();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const goalChain: {
      eq: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn(),
      select: vi.fn(() => ({ maybeSingle })),
    };
    goalChain.eq.mockImplementation(() => goalChain);
    mocks.adminClient = {
      from: vi.fn((table: string) =>
        table === "matches" ? matchLookup : { delete: () => goalChain },
      ),
    };

    await expect(
      removeGoal("match-1", "member-1", "missing-goal"),
    ).resolves.toEqual({ error: "得点が見つかりません。画面を更新してください" });
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("DBから解決したイベントに対して得点取消後の関連画面を再検証する", async () => {
    const matchLookup = createMatchLookup();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "goal-1" },
      error: null,
    });
    const goalChain: {
      eq: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn(),
      select: vi.fn(() => ({ maybeSingle })),
    };
    goalChain.eq.mockImplementation(() => goalChain);
    mocks.adminClient = {
      from: vi.fn((table: string) =>
        table === "matches" ? matchLookup : { delete: () => goalChain },
      ),
    };

    await expect(
      removeGoal("match-1", "member-1", "goal-1"),
    ).resolves.toEqual({ error: null });
    expectGoalPathsRevalidated();
  });
});
