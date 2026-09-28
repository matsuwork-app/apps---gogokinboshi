import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "../supabase/server";
import { getPublicRankings } from "./server";

const mockedCreateClient = vi.mocked(createClient);

describe("getPublicRankings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("集計RPCの値をRankingRowへ正規化する", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          member_id: "member-1",
          name: "テスト選手",
          total_goals: "3",
          participated_events: "2",
          total_events: "4",
          rank: "1",
        },
      ],
      error: null,
    });
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    await expect(getPublicRankings("2026-09-01", "2026-09-30")).resolves.toEqual([
      {
        member_id: "member-1",
        name: "テスト選手",
        total_goals: 3,
        participated_events: 2,
        total_events: 4,
        rank: 1,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("get_public_rankings", {
      p_from_date: "2026-09-01",
      p_to_date: "2026-09-30",
    });
  });

  it("Supabaseエラーを空ランキングへ変換しない", async () => {
    mockedCreateClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "database unavailable" } }),
    } as never);

    await expect(getPublicRankings("2026-09-01", "2026-09-30")).rejects.toThrow(
      "ランキングの取得に失敗しました"
    );
  });

  it("不正な期間ではRPCを呼ばない", async () => {
    const rpc = vi.fn();
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    await expect(getPublicRankings("2026-09-31", "2026-10-01")).rejects.toThrow(
      "期間を正しく指定してください"
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});
