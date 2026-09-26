import { describe, expect, it } from "vitest";

import {
  getNextRecommendedPair,
  getRestingTeamIds,
  getRotation,
  type MatchPair,
} from "./rotation";

describe("getRotation", () => {
  it.each([
    [["A", "B"], [["A", "B"]]],
    [
      ["A", "B", "C"],
      [
        ["A", "B"],
        ["C", "A"],
        ["B", "C"],
      ],
    ],
    [
      ["A", "B", "C", "D"],
      [
        ["A", "B"],
        ["C", "D"],
        ["A", "C"],
        ["B", "D"],
        ["A", "D"],
        ["B", "C"],
      ],
    ],
  ])("%j の既定ローテーションを返す", (teamIds, expected) => {
    expect(getRotation(teamIds)).toEqual(expected);
  });

  it.each([
    [[]],
    [["A"]],
    [["A", "B", "C", "D", "E"]],
    [["A", "A"]],
  ])("2〜4個の重複しないteam ID以外を拒否する: %j", (teamIds) => {
    expect(() => getRotation(teamIds)).toThrow();
  });
});

describe("getNextRecommendedPair", () => {
  const fourTeams = ["A", "B", "C", "D"];

  it("履歴がなければ最初のカードを返す", () => {
    expect(getNextRecommendedPair(fourTeams, [])).toEqual(["A", "B"]);
  });

  it("既定カードを順番に進め、1巡後は先頭へ戻る", () => {
    const round = getRotation(fourTeams);

    expect(getNextRecommendedPair(fourTeams, round.slice(0, 2))).toEqual([
      "A",
      "C",
    ]);
    expect(getNextRecommendedPair(fourTeams, round)).toEqual(["A", "B"]);
  });

  it("対戦ペアの左右が逆でも同じカードとして数える", () => {
    expect(getNextRecommendedPair(fourTeams, [["B", "A"]])).toEqual([
      "C",
      "D",
    ]);
  });

  it("手動で後続カードを先に実施しても、未実施の先頭カードを推薦する", () => {
    const history: MatchPair[] = [
      ["A", "B"],
      ["A", "C"], // 既定順では3番目を手動で先に実施
    ];

    expect(getNextRecommendedPair(fourTeams, history)).toEqual(["C", "D"]);
  });

  it("実施回数が最少のカードを既定順で選び、偏りを均す", () => {
    const history: MatchPair[] = [
      ["A", "B"],
      ["C", "D"],
      ["A", "C"],
      ["B", "D"],
      ["A", "D"],
      ["B", "C"],
      ["A", "B"], // 2巡目にABを手動で先行
    ];

    expect(getNextRecommendedPair(fourTeams, history)).toEqual(["C", "D"]);
  });

  it("2チームの場合は同じカードを繰り返す", () => {
    expect(
      getNextRecommendedPair(
        ["home", "away"],
        [
          ["home", "away"],
          ["away", "home"],
        ],
      ),
    ).toEqual(["home", "away"]);
  });

  it.each([
    [[["A", "A"]] as MatchPair[]],
    [[["A", "unknown"]] as MatchPair[]],
  ])("不正な履歴カードを拒否する: %j", (history) => {
    expect(() => getNextRecommendedPair(fourTeams, history)).toThrow();
  });
});

describe("getRestingTeamIds", () => {
  it("対戦していないteam IDsを入力順で返す", () => {
    expect(getRestingTeamIds(["A", "B", "C", "D"], ["D", "B"])).toEqual([
      "A",
      "C",
    ]);
  });

  it("2チーム対戦では空配列を返す", () => {
    expect(getRestingTeamIds(["A", "B"], ["A", "B"])).toEqual([]);
  });

  it.each([
    [["A", "A"] as MatchPair],
    [["A", "unknown"] as MatchPair],
  ])("同一team対戦または存在しないteamを拒否する: %j", (pair) => {
    expect(() => getRestingTeamIds(["A", "B", "C"], pair)).toThrow();
  });
});
