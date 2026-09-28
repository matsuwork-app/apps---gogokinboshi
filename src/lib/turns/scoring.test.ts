import { describe, expect, it } from "vitest";

import { adjustTurnGoalCounts, type TurnTeam } from "./scoring";

const teams: TurnTeam[] = [
  {
    id: "team-a",
    teamCode: "A",
    displayName: "チームA",
    sortOrder: 1,
    players: [
      {
        id: "member-1",
        name: "選手A",
        turnGoals: 2,
        dailyGoals: 5,
        goalIds: ["goal-1", "goal-2"],
      },
    ],
  },
];

describe("ターン得点の楽観更新", () => {
  it("ターン得点と本日累計を同時に増減する", () => {
    const added = adjustTurnGoalCounts(teams, "member-1", 1);

    expect(added[0].players[0]).toMatchObject({
      turnGoals: 3,
      dailyGoals: 6,
    });
    expect(adjustTurnGoalCounts(added, "member-1", -1)[0].players[0]).toMatchObject({
      turnGoals: 2,
      dailyGoals: 5,
    });
  });

  it("得点は0未満にしない", () => {
    const empty = teams.map((team) => ({
      ...team,
      players: team.players.map((player) => ({
        ...player,
        turnGoals: 0,
        dailyGoals: 0,
      })),
    }));

    expect(adjustTurnGoalCounts(empty, "member-1", -1)[0].players[0]).toMatchObject({
      turnGoals: 0,
      dailyGoals: 0,
    });
  });
});
