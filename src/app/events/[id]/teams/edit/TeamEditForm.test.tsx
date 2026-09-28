import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/events", () => ({
  reassignEventTeamMembers: vi.fn(),
}));
vi.mock("@/app/actions/auth", () => ({ unlockManager: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import TeamEditForm, { type TeamForEdit } from "./TeamEditForm";

const teams: TeamForEdit[] = [
  { id: "team-a", teamCode: "A", displayName: "チームA", sortOrder: 1 },
  { id: "team-b", teamCode: "B", displayName: "チームB", sortOrder: 2 },
  { id: "team-c", teamCode: "C", displayName: "チームC", sortOrder: 3 },
];

const members = [
  { id: "member-1", name: "青木", eventTeamId: "team-a", dailyGoals: 2 },
  { id: "member-2", name: "井上", eventTeamId: "team-b", dailyGoals: 0 },
  { id: "member-3", name: "上田", eventTeamId: "team-c", dailyGoals: 1 },
];

describe("チーム編成フォーム", () => {
  it("各参加者の当日得点と変更の適用範囲を表示する", () => {
    const markup = renderToStaticMarkup(
      <TeamEditForm
        eventId="event-1"
        teams={teams}
        members={members}
        hasUnfinishedMatch={false}
        initialCanManage
      />,
    );

    expect(markup).toContain("青木");
    expect(markup).toContain("本日 2点");
    expect(markup).toContain('aria-label="青木の所属チーム"');
    expect(markup).toContain("次に作成する試合から反映");
    expect(markup).toContain("過去の試合結果やメンバー構成は変わりません");
    expect(markup).toContain("編成を保存");
  });

  it("未終了試合があると保存を無効化して理由を表示する", () => {
    const markup = renderToStaticMarkup(
      <TeamEditForm
        eventId="event-1"
        teams={teams}
        members={members}
        hasUnfinishedMatch
        initialCanManage={false}
      />,
    );

    expect(markup).toContain("未終了の試合があります");
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>編成を保存<\/button>/);
  });
});
