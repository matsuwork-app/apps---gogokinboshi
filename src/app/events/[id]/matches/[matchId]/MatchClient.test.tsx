import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/matches", () => ({
  addGoal: vi.fn(),
  removeGoal: vi.fn(),
  setPlayerPlaying: vi.fn(),
  transitionMatch: vi.fn(),
}));
vi.mock("@/app/actions/auth", () => ({ unlockManager: vi.fn() }));

import MatchClient, {
  adjustPlayerGoalCounts,
  type MatchPlayer,
} from "./MatchClient";
import { buildNonLineupTeams } from "./nonLineup";
import type { Match } from "@/types";

const finishedMatch: Match = {
  active_started_at: null,
  created_at: "2026-09-28T00:00:00.000Z",
  elapsed_seconds: 600,
  ended_at: "2026-09-28T00:10:00.000Z",
  event_id: "event-1",
  id: "match-1",
  match_number: 1,
  started_at: "2026-09-28T00:00:00.000Z",
  status: "finished",
};

const players: MatchPlayer[] = [
  {
    member: {
      created_at: "2026-09-28T00:00:00.000Z",
      id: "member-1",
      name: "テスト選手",
    },
    side: 1,
    goals: 1,
    dailyGoals: 4,
    isPlaying: true,
  },
];

const teams = [
  {
    matchTeamId: "match-team-1",
    eventTeamId: "event-team-1",
    side: 1 as const,
    teamCode: "A" as const,
    displayName: "チームA",
  },
  {
    matchTeamId: "match-team-2",
    eventTeamId: "event-team-2",
    side: 2 as const,
    teamCode: "B" as const,
    displayName: "チームB",
  },
];

describe("終了済み試合の管理操作", () => {
  it("休憩チームの現在の所属選手と当日累計を表示する", () => {
    const markup = renderToStaticMarkup(
      <MatchClient
        match={finishedMatch}
        initialPlayers={players}
        initialGoalIds={{ "member-1": ["goal-1"] }}
        eventId="event-1"
        teams={teams}
        nonLineupTeams={[
          {
            teamCode: "A",
            displayName: "チームA",
            members: [
              {
                id: "member-2",
                name: "休憩選手",
                dailyGoals: 3,
              },
            ],
          },
        ]}
        initialCanManage={false}
      />,
    );

    expect(markup).toContain("休憩選手");
    expect(markup).toContain('aria-label="休憩選手 本日 3点"');
  });

  it("選手名の横に当日の累計得点を表示する", () => {
    const markup = renderToStaticMarkup(
      <MatchClient
        match={finishedMatch}
        initialPlayers={players}
        initialGoalIds={{ "member-1": ["goal-1"] }}
        eventId="event-1"
        teams={teams}
        nonLineupTeams={[]}
        initialCanManage={false}
      />,
    );

    expect(markup).toContain("本日 4点");
    expect(markup).toContain('aria-label="テスト選手 本日 4点"');
  });

  it("管理者には得点修正ボタンだけを表示する", () => {
    const markup = renderToStaticMarkup(
      <MatchClient
        match={finishedMatch}
        initialPlayers={players}
        initialGoalIds={{ "member-1": ["goal-1"] }}
        eventId="event-1"
        teams={teams}
        nonLineupTeams={[]}
        initialCanManage
      />,
    );

    expect(markup).toContain("テスト選手の得点を1点取り消す");
    expect(markup).toContain("テスト選手に1点追加");
    expect(markup).not.toContain("テスト選手をベンチに変更");
    expect(markup).not.toContain("試合終了");
  });

  it("未認証なら得点修正の認証ボタンを表示する", () => {
    const markup = renderToStaticMarkup(
      <MatchClient
        match={finishedMatch}
        initialPlayers={players}
        initialGoalIds={{ "member-1": ["goal-1"] }}
        eventId="event-1"
        teams={teams}
        nonLineupTeams={[]}
        initialCanManage={false}
      />,
    );

    expect(markup).toContain("得点を修正");
    expect(markup).not.toContain("テスト選手に1点追加");
  });
});

describe("得点の楽観更新", () => {
  it("試合得点と当日累計を同時に増減し、ロールバックで元に戻す", () => {
    const added = adjustPlayerGoalCounts(players, "member-1", 1);

    expect(added[0]).toMatchObject({ goals: 2, dailyGoals: 5 });
    expect(adjustPlayerGoalCounts(added, "member-1", -1)[0]).toMatchObject({
      goals: 1,
      dailyGoals: 4,
    });
  });
});

describe("試合ラインナップ外の参加者", () => {
  it("ラインナップを除外し、対戦チームへの現在所属者も表示対象にする", () => {
    const eventTeams = [
      {
        id: "event-team-1",
        event_id: "event-1",
        team_code: "A" as const,
        display_name: "チームA",
        sort_order: 1,
        created_at: "2026-09-28T00:00:00.000Z",
      },
      {
        id: "event-team-3",
        event_id: "event-1",
        team_code: "C" as const,
        display_name: "チームC",
        sort_order: 3,
        created_at: "2026-09-28T00:00:00.000Z",
      },
    ];
    const member = (id: string, name: string) => ({
      id,
      name,
      created_at: "2026-09-28T00:00:00.000Z",
    });
    const memberships = [
      {
        event_team_id: "event-team-1",
        member_id: "member-1",
        members: member("member-1", "ラインナップ選手"),
      },
      {
        event_team_id: "event-team-1",
        member_id: "member-2",
        members: member("member-2", "対戦チーム現所属選手"),
      },
      {
        event_team_id: "event-team-3",
        member_id: "member-3",
        members: member("member-3", "別チーム選手"),
      },
    ];

    const result = buildNonLineupTeams(
      eventTeams,
      memberships,
      new Set(["member-1"]),
      { "member-2": 2, "member-3": 1 }
    );

    expect(result).toEqual([
      {
        teamCode: "A",
        displayName: "チームA",
        members: [
          { id: "member-2", name: "対戦チーム現所属選手", dailyGoals: 2 },
        ],
      },
      {
        teamCode: "C",
        displayName: "チームC",
        members: [{ id: "member-3", name: "別チーム選手", dailyGoals: 1 }],
      },
    ]);
  });
});
