import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/turns", () => ({
  addTurnGoal: vi.fn(),
  removeTurnGoal: vi.fn(),
}));

import TurnScoringClient from "./TurnScoringClient";

describe("ターン得点画面", () => {
  it("全チームを縦に並べ、個人のターン得点と本日累計を表示する", () => {
    const markup = renderToStaticMarkup(
      <TurnScoringClient
        eventId="event-1"
        turnId="turn-1"
        turnNumber={2}
        initialTeams={[
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
          {
            id: "team-b",
            teamCode: "B",
            displayName: "チームB",
            sortOrder: 2,
            players: [
              {
                id: "member-2",
                name: "選手B",
                turnGoals: 0,
                dailyGoals: 1,
                goalIds: [],
              },
            ],
          },
        ]}
      />
    );

    expect(markup.indexOf("チームA")).toBeLessThan(markup.indexOf("チームB"));
    expect(markup).toContain('aria-label="選手A 本日 5点"');
    expect(markup).toContain('aria-label="選手Aの得点を1点追加"');
    expect(markup).toContain('aria-label="選手Aの得点を1点取り消す"');
    expect(markup).toContain('aria-label="選手A ターン得点 2点"');
  });
});
