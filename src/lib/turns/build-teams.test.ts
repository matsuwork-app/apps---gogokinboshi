import { describe, expect, it } from "vitest";

import { buildTurnTeams } from "./build-teams";

describe("ターン表示データ", () => {
  it("現在ターン得点と旧試合・全ターンを含む本日累計を分けて集計する", () => {
    const teams = buildTurnTeams({
      currentTurnId: "turn-2",
      eventTeams: [
        {
          id: "team-a",
          team_code: "A",
          display_name: "チームA",
          sort_order: 1,
        },
      ],
      memberships: [{ event_team_id: "team-a", member_id: "member-1" }],
      members: [{ id: "member-1", name: "選手A" }],
      legacyGoals: [{ member_id: "member-1" }],
      turnGoals: [
        { id: "old", member_id: "member-1", event_turn_id: "turn-1" },
        { id: "current-1", member_id: "member-1", event_turn_id: "turn-2" },
        { id: "current-2", member_id: "member-1", event_turn_id: "turn-2" },
      ],
    });

    expect(teams[0].players[0]).toEqual({
      id: "member-1",
      name: "選手A",
      turnGoals: 2,
      dailyGoals: 4,
      goalIds: ["current-1", "current-2"],
    });
  });
});
