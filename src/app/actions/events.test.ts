import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminClient: undefined as unknown,
  requireApprovedUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireApprovedUser: mocks.requireApprovedUser,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.adminClient,
}));

import { createEventTurn } from "./events";

const assignments = [
  { member_id: "member-1", event_team_id: "team-a" },
  { member_id: "member-2", event_team_id: "team-b" },
];

describe("チーム再編成Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApprovedUser.mockResolvedValue({ id: "user-1" });
  });

  it("管理者認証後にRPCを実行し関連画面を再検証する", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ turn_id: "turn-2", turn_number: 2 }],
      error: null,
    });
    mocks.adminClient = { rpc };

    await expect(
      createEventTurn("event-1", assignments),
    ).resolves.toEqual({ error: null, turnId: "turn-2", turnNumber: 2 });

    expect(mocks.requireApprovedUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_event_turn", {
      p_event_id: "event-1",
      p_assignments: assignments,
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/events/event-1"],
      ["/events/event-1/teams/edit"],
      ["/events/event-1/turns/turn-2"],
    ]);
  });

  it("同じ参加者の重複割り当てをRPC前に拒否する", async () => {
    const rpc = vi.fn();
    mocks.adminClient = { rpc };

    await expect(
      createEventTurn("event-1", [
        { member_id: "member-1", event_team_id: "team-a" },
        { member_id: "member-1", event_team_id: "team-b" },
      ]),
    ).resolves.toEqual({ error: "同じ参加者を複数チームへ割り当てることはできません" });

    expect(mocks.requireApprovedUser).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("空のチームを含む割り当てをRPC前に拒否する", async () => {
    const rpc = vi.fn();
    mocks.adminClient = { rpc };

    await expect(
      createEventTurn("event-1", [
        { member_id: "member-1", event_team_id: "team-a" },
        { member_id: "member-2", event_team_id: "team-a" },
      ]),
    ).resolves.toEqual({ error: "2〜4チームすべてに1名以上割り当ててください" });

    expect(rpc).not.toHaveBeenCalled();
  });
});
