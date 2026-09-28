import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RankingTable from "./RankingTable";

describe("RankingTable", () => {
  it("得点とイベント参加率だけを表示し、出場時間を表示しない", () => {
    const markup = renderToStaticMarkup(
      <RankingTable
        ranking={[
          {
            member_id: "member-1",
            name: "青木",
            total_goals: 4,
            participated_events: 2,
            total_events: 4,
            rank: 1,
          },
        ]}
      />,
    );

    expect(markup).toContain("青木");
    expect(markup).toContain("50%");
    expect(markup).not.toContain("出場時間");
  });
});
