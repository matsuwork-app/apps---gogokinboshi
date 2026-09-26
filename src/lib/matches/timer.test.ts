import { describe, expect, it } from "vitest";

import { calculateElapsedSeconds } from "./timer";

describe("calculateElapsedSeconds", () => {
  it("一時停止中は保存済み経過秒をそのまま返す", () => {
    expect(
      calculateElapsedSeconds({
        elapsedSeconds: 125,
        activeStartedAt: null,
        now: new Date("2026-09-26T10:05:00.000Z"),
      })
    ).toBe(125);
  });

  it("進行中は保存済み経過秒に現在区間を加算する", () => {
    expect(
      calculateElapsedSeconds({
        elapsedSeconds: 125,
        activeStartedAt: "2026-09-26T10:00:00.000Z",
        now: new Date("2026-09-26T10:01:15.900Z"),
      })
    ).toBe(200);
  });

  it("端末時計が開始時刻より前でも負数を加算しない", () => {
    expect(
      calculateElapsedSeconds({
        elapsedSeconds: 30,
        activeStartedAt: "2026-09-26T10:00:10.000Z",
        now: new Date("2026-09-26T10:00:00.000Z"),
      })
    ).toBe(30);
  });
});
