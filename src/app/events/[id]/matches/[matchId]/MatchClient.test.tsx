import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/matches", () => ({
  addGoal: vi.fn(),
  removeGoal: vi.fn(),
  setPlayerPlaying: vi.fn(),
  transitionMatch: vi.fn(),
}));
vi.mock("@/app/actions/auth", () => ({ unlockManager: vi.fn() }));

import MatchClient, { type MatchPlayer } from "./MatchClient";
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
  it("管理者には得点修正ボタンだけを表示する", () => {
    const markup = renderToStaticMarkup(
      <MatchClient
        match={finishedMatch}
        initialPlayers={players}
        initialGoalIds={{ "member-1": ["goal-1"] }}
        eventId="event-1"
        teams={teams}
        restingTeams={[]}
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
        restingTeams={[]}
        initialCanManage={false}
      />,
    );

    expect(markup).toContain("得点を修正");
    expect(markup).not.toContain("テスト選手に1点追加");
  });
});
