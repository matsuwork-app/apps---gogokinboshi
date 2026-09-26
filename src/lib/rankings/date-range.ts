import { getJapanDateRangeUtc, toJapanDateString } from "../dates/japan";

export type RankingPeriod = { from: string; to: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_RANKING_PERIOD_MS = 3_660 * 24 * 60 * 60 * 1_000;

function formatDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftDate(value: string, months: number): string {
  const parsed = parseDate(value);
  if (!parsed) throw new Error("日付はYYYY-MM-DD形式で指定してください");

  const monthIndex = parsed.year * 12 + parsed.month - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  return formatDate(year, month, Math.min(parsed.day, daysInMonth(year, month)));
}

function getJstDate(now: Date): { year: number; month: number; day: number } {
  const parsed = parseDate(toJapanDateString(now));
  if (!parsed) throw new RangeError("日本時間の日付を生成できませんでした");
  return parsed;
}

export function isValidDateRange(from: string, to: string): boolean {
  try {
    const { startInclusive, endExclusive } = getJapanDateRangeUtc(from, to);
    return (
      new Date(endExclusive).getTime() - new Date(startInclusive).getTime() <=
      MAX_RANKING_PERIOD_MS + 24 * 60 * 60 * 1_000
    );
  } catch {
    return false;
  }
}

export function getDefaultDashboardPeriod(now = new Date()): RankingPeriod {
  const current = getJstDate(now);
  return {
    from: formatDate(current.year - 1, current.month, 1),
    to: formatDate(current.year, current.month, current.day),
  };
}

export function getDefaultModalPeriod(now = new Date()): RankingPeriod {
  const current = getJstDate(now);
  const previousYearDay = Math.min(
    current.day,
    daysInMonth(current.year - 1, current.month)
  );
  return {
    from: formatDate(current.year - 1, current.month, previousYearDay),
    to: formatDate(current.year, current.month, current.day),
  };
}

export function shiftPeriodByMonths(
  from: string,
  to: string,
  months: number
): RankingPeriod {
  return { from: shiftDate(from, months), to: shiftDate(to, months) };
}

export function formatPeriodMonthLabel(from: string, to: string): string {
  const first = parseDate(from);
  const last = parseDate(to);
  if (!first || !last) return "";
  return `${first.year}年${first.month}月 〜 ${last.year}年${last.month}月`;
}

export function formatJapaneseDate(value: string): string {
  const parsed = parseDate(value);
  return parsed ? `${parsed.year}年${parsed.month}月${parsed.day}日` : value;
}
