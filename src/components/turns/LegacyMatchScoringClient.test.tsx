import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/matches", () => ({
  addGoal: vi.fn(),
  removeGoal: vi.fn(),
}));

import LegacyMatchScoringClient from "./LegacyMatchScoringClient";

describe("旧試合の得点修正", () => {
  it("試合得点と本日累計を表示し、個人得点を追加・取消できる", () => {
    const markup = renderToStaticMarkup(
      <LegacyMatchScoringClient
        matchId="match-1"
        initialTeams={[
          {
            id: "team-a",
            teamCode: "A",
            displayName: "チームA",
            players: [
              {
                id: "member-1",
                name: "青木",
                matchGoals: 2,
                dailyGoals: 4,
                goalIds: ["goal-1", "goal-2"],
              },
            ],
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-label="青木 本日 4点"');
    expect(markup).toContain('aria-label="青木 この試合 2点"');
    expect(markup).toContain('aria-label="青木の得点を1点追加"');
    expect(markup).toContain('aria-label="青木の得点を1点取り消す"');
  });
});
