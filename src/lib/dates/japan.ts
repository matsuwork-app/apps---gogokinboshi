const JAPAN_TIME_ZONE = "Asia/Tokyo";
const JAPAN_UTC_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const japanDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: JAPAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toJapanDateString(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("有効な日時を指定してください");
  }

  const parts = japanDateFormatter.formatToParts(date);
  const year = parts.find(({ type }) => type === "year")?.value;
  const month = parts.find(({ type }) => type === "month")?.value;
  const day = parts.find(({ type }) => type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("日本時間の日付を生成できませんでした");
  }

  return `${year}-${month}-${day}`;
}

function japanDateStartUtcMs(value: string): number {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) throw new RangeError("日付はYYYY-MM-DD形式で指定してください");

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new RangeError("存在する日付を指定してください");
  }

  return calendarDate.getTime() - JAPAN_UTC_OFFSET_MS;
}

export function getJapanDateRangeUtc(from: string, to: string): {
  startInclusive: string;
  endExclusive: string;
} {
  const startMs = japanDateStartUtcMs(from);
  const lastDayStartMs = japanDateStartUtcMs(to);
  if (startMs > lastDayStartMs) {
    throw new RangeError("開始日は終了日以前にしてください");
  }

  return {
    startInclusive: new Date(startMs).toISOString(),
    endExclusive: new Date(lastDayStartMs + DAY_MS).toISOString(),
  };
}
