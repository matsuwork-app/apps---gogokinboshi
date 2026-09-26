import { describe, expect, it } from "vitest";

import { getJapanDateRangeUtc, toJapanDateString } from "./japan";

describe("toJapanDateString", () => {
  it("UTCでは前日でもJSTの当日を返す", () => {
    const instant = new Date("2026-09-25T15:00:00.000Z");

    expect(instant.toISOString().slice(0, 10)).toBe("2026-09-25");
    expect(toJapanDateString(instant)).toBe("2026-09-26");
  });

  it("JSTの日付変更直前と直後を区別する", () => {
    expect(toJapanDateString(new Date("2026-09-26T14:59:59.999Z"))).toBe(
      "2026-09-26",
    );
    expect(toJapanDateString(new Date("2026-09-26T15:00:00.000Z"))).toBe(
      "2026-09-27",
    );
  });

  it("不正な日時を拒否する", () => {
    expect(() => toJapanDateString(new Date(Number.NaN))).toThrow(
      "有効な日時を指定してください",
    );
  });
});

describe("getJapanDateRangeUtc", () => {
  it("JSTの同日をUTCの開始以上・翌日開始未満へ変換する", () => {
    expect(getJapanDateRangeUtc("2026-09-26", "2026-09-26")).toEqual({
      startInclusive: "2026-09-25T15:00:00.000Z",
      endExclusive: "2026-09-26T15:00:00.000Z",
    });
  });

  it("月末をまたぐ範囲を安全に変換する", () => {
    expect(getJapanDateRangeUtc("2026-01-31", "2026-02-01")).toEqual({
      startInclusive: "2026-01-30T15:00:00.000Z",
      endExclusive: "2026-02-01T15:00:00.000Z",
    });
  });

  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026/09/26", "2026-09-27"],
    ["2026-09-27", "2026-09-26"],
  ])("不正または逆転した期間を拒否する: %s〜%s", (from, to) => {
    expect(() => getJapanDateRangeUtc(from, to)).toThrow();
  });
});
