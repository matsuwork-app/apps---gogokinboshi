import { describe, expect, it } from "vitest";

import {
  getDefaultDashboardPeriod,
  getDefaultModalPeriod,
  isValidDateRange,
  shiftPeriodByMonths,
} from "./date-range";

describe("ranking date range", () => {
  it("JSTの日付を基準にダッシュボードの直近1年を作る", () => {
    expect(getDefaultDashboardPeriod(new Date("2026-01-31T15:30:00Z"))).toEqual({
      from: "2025-02-01",
      to: "2026-02-01",
    });
  });

  it("モーダルの初期期間はJSTの同日から1年前にする", () => {
    expect(getDefaultModalPeriod(new Date("2026-01-31T15:30:00Z"))).toEqual({
      from: "2025-02-01",
      to: "2026-02-01",
    });
  });

  it("月末を含む期間を暦月単位で移動する", () => {
    expect(shiftPeriodByMonths("2026-01-31", "2026-02-28", 1)).toEqual({
      from: "2026-02-28",
      to: "2026-03-28",
    });
  });

  it("実在日と期間順序を検証する", () => {
    expect(isValidDateRange("2024-02-29", "2024-03-01")).toBe(true);
    expect(isValidDateRange("2026-02-29", "2026-03-01")).toBe(false);
    expect(isValidDateRange("2026-03-02", "2026-03-01")).toBe(false);
  });

  it("公開集計の期間を最大3660日に制限する", () => {
    expect(isValidDateRange("2020-01-01", "2030-01-08")).toBe(true);
    expect(isValidDateRange("2020-01-01", "2030-01-09")).toBe(false);
  });
});
