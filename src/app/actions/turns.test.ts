import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminClient: undefined as unknown,
  requireApprovedUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/users", () => ({
  requireApprovedUser: mocks.requireApprovedUser,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.adminClient,
}));

import { addTurnGoal, removeTurnGoal } from "./turns";

function createTurnLookup(eventId = "event-1") {
  const single = vi.fn().mockResolvedValue({
    data: { event_id: eventId },
    error: null,
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, single };
}

describe("ターン得点Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApprovedUser.mockResolvedValue({ id: "app-user-1" });
  });

  it("承認済みユーザーを検証して得点を追加する", async () => {
    const turnLookup = createTurnLookup();
    const singleGoal = vi.fn().mockResolvedValue({
      data: { id: "goal-1" },
      error: null,
    });
    const selectGoal = vi.fn(() => ({ single: singleGoal }));
    const insertGoal = vi.fn(() => ({ select: selectGoal }));
    mocks.adminClient = {
      from: vi.fn((table: string) =>
        table === "event_turns" ? turnLookup : { insert: insertGoal }
      ),
    };

    await expect(addTurnGoal("turn-1", "member-1")).resolves.toEqual({
      id: "goal-1",
    });
    expect(mocks.requireApprovedUser).toHaveBeenCalledOnce();
    expect(insertGoal).toHaveBeenCalledWith({
      event_turn_id: "turn-1",
      member_id: "member-1",
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/events/event-1"],
      ["/events/event-1/turns/turn-1"],
      ["/"],
    ]);
  });

  it("得点取消はID・ターン・メンバーをすべて照合する", async () => {
    const turnLookup = createTurnLookup();
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
        table === "event_turns" ? turnLookup : { delete: () => goalChain }
      ),
    };

    await expect(
      removeTurnGoal("turn-1", "member-1", "goal-1")
    ).resolves.toEqual({ error: null });
    expect(goalChain.eq.mock.calls).toEqual([
      ["id", "goal-1"],
      ["event_turn_id", "turn-1"],
      ["member_id", "member-1"],
    ]);
  });
});
