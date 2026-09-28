import { describe, expect, it } from "vitest";

import {
  COUNTDOWN_PRESETS,
  formatCountdown,
  getRemainingSeconds,
  minutesToSeconds,
} from "./countdown";

describe("ターン用カウントダウン", () => {
  it("5分・7分・10分をプリセットとして提供する", () => {
    expect(COUNTDOWN_PRESETS).toEqual([5, 7, 10]);
    expect(COUNTDOWN_PRESETS.map(minutesToSeconds)).toEqual([300, 420, 600]);
  });

  it("締切時刻から残り秒を切り上げ計算し、0未満にしない", () => {
    expect(getRemainingSeconds(10_000, 8_500)).toBe(2);
    expect(getRemainingSeconds(10_000, 10_001)).toBe(0);
  });

  it("分秒を2桁で表示する", () => {
    expect(formatCountdown(420)).toBe("07:00");
    expect(formatCountdown(65)).toBe("01:05");
  });
});
