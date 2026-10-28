// Europe/London calendar arithmetic for the Autofix Diary.
//
// Every stored time is a timestamptz (UTC instant). Staff think in local
// wall-clock time, which is GMT in winter and BST (UTC+1) in summer. These
// helpers convert between the two without a date library and are safe on the
// clock-change days: the spring-forward day has 23 hours (01:00-01:59 does not
// exist) and the fall-back day has 25 hours (01:00-01:59 happens twice).

export const DIARY_TIME_ZONE = "Europe/London";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d$/;
const HOUR = 3_600_000;

export type DiaryView = "day" | "week" | "month" | "agenda";
export const diaryViews: readonly DiaryView[] = ["day", "week", "month", "agenda"];

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DIARY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function wallClock(instant: number): WallClock {
  const parts = partsFormatter.formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour") % 24, minute: read("minute"), second: read("second") };
}

/** Offset of London from UTC at an instant, in milliseconds (0 for GMT, 3,600,000 for BST). */
export function londonOffset(instant: number) {
  const wall = wallClock(instant);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isTimeKey(value: unknown): value is string {
  return typeof value === "string" && TIME_KEY.test(value);
}

/** The London calendar date (YYYY-MM-DD) of an instant. */
export function londonDateKey(value: Date | string | number) {
  const instant = typeof value === "number" ? value : new Date(value).getTime();
  const wall = wallClock(instant);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** The London wall-clock time (HH:mm) of an instant. */
export function londonTimeKey(value: Date | string | number) {
  const instant = typeof value === "number" ? value : new Date(value).getTime();
  const wall = wallClock(instant);
  return `${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** Minutes since local midnight on the London wall clock (0-1439). */
export function londonMinutesOfDay(value: Date | string | number) {
  const instant = typeof value === "number" ? value : new Date(value).getTime();
  const wall = wallClock(instant);
  return wall.hour * 60 + wall.minute;
}

/**
 * Convert a London wall-clock date and time to a UTC instant.
 *
 * Returns null for a time that does not exist (the hour skipped when the
 * clocks go forward). For a time that happens twice (the hour repeated when
 * the clocks go back) it returns the first occurrence, which is BST, unless
 * `occurrence: "later"` is given.
 */
export function londonToUtc(date: string, time: string, options: { occurrence?: "earlier" | "later" } = {}): Date | null {
  if (!isDateKey(date) || !isTimeKey(time)) return null;
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set([londonOffset(naive - 12 * HOUR), londonOffset(naive + 12 * HOUR), londonOffset(naive)]);
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((instant) => {
      const wall = wallClock(instant);
      return wall.year === year && wall.month === month && wall.day === day && wall.hour === hour && wall.minute === minute;
    })
    .sort((left, right) => left - right);
  if (!candidates.length) return null;
  const chosen = options.occurrence === "later" ? candidates[candidates.length - 1] : candidates[0];
  return new Date(chosen as number);
}

/** UTC instant of local midnight at the start of a London calendar date. */
export function londonMidnight(date: string) {
  // Midnight always exists in London (the clocks change at 01:00 UTC).
  return londonToUtc(date, "00:00") as Date;
}

/** Whether a local time is skipped (spring forward) or repeated (fall back) on that date. */
export function clockChangeNote(date: string, time: string): "skipped" | "repeated" | null {
  if (!isDateKey(date) || !isTimeKey(time)) return null;
  const earlier = londonToUtc(date, time);
  if (!earlier) return "skipped";
  const later = londonToUtc(date, time, { occurrence: "later" });
  return later && later.getTime() !== earlier.getTime() ? "repeated" : null;
}

/** Hours in a London calendar day: 24 normally, 23 when the clocks go forward, 25 when they go back. */
export function londonDayLengthHours(date: string) {
  return (londonMidnight(addDays(date, 1)).getTime() - londonMidnight(date).getTime()) / HOUR;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(date: string) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: string) {
  return addDays(date, -weekdayIndex(date));
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
}

export function dateKeysInRange(start: string, endExclusive: string) {
  const keys: string[] = [];
  for (let key = start; key < endExclusive; key = addDays(key, 1)) keys.push(key);
  return keys;
}

export type DiaryRange = {
  view: DiaryView;
  /** The date the view is anchored on. */
  date: string;
  /** First calendar date shown (inclusive). */
  start: string;
  /** Day after the last calendar date shown (exclusive). */
  end: string;
  startUtc: string;
  endUtc: string;
};

/** Calendar days covered by a view. Weeks start on Monday; month views show whole weeks. */
export function diaryRange(view: DiaryView, date: string): DiaryRange {
  let start = date;
  let end = addDays(date, 1);
  if (view === "week") {
    start = startOfWeek(date);
    end = addDays(start, 7);
  } else if (view === "agenda") {
    end = addDays(date, 7);
  } else if (view === "month") {
    const first = startOfMonth(date);
    start = startOfWeek(first);
    const nextMonth = addMonths(first, 1);
    end = addDays(startOfWeek(addDays(nextMonth, -1)), 7);
  }
  return { view, date, start, end, startUtc: londonMidnight(start).toISOString(), endUtc: londonMidnight(end).toISOString() };
}

/** The anchor date for the previous or next page of a view. */
export function shiftDiaryDate(view: DiaryView, date: string, direction: -1 | 1) {
  if (view === "month") return addMonths(startOfMonth(date), direction);
  if (view === "week" || view === "agenda") return addDays(date, 7 * direction);
  return addDays(date, direction);
}

/** Whether [start, end) overlaps the London calendar range [rangeStartUtc, rangeEndUtc). */
export function overlapsRange(start: string, end: string, rangeStartUtc: string, rangeEndUtc: string) {
  return Date.parse(start) < Date.parse(rangeEndUtc) && Date.parse(end) > Date.parse(rangeStartUtc);
}

const longDate = new Intl.DateTimeFormat("en-GB", { timeZone: DIARY_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: DIARY_TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const monthTitle = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

/** "Friday 30 October 2026" for a calendar date. */
export function formatDateKeyLong(date: string) {
  return longDate.format(new Date(`${date}T12:00:00Z`));
}

/** "Fri 30 Oct" for a calendar date. */
export function formatDateKeyShort(date: string) {
  return shortDate.format(new Date(`${date}T12:00:00Z`));
}

/** "Friday 30 October 2026 at 11:00" for an instant, in London time. */
export function formatLondonDateTime(value: string | Date) {
  const instant = typeof value === "string" ? value : value.toISOString();
  return `${formatDateKeyLong(londonDateKey(instant))} at ${londonTimeKey(instant)}`;
}

/** "11:00 to 11:45" (adds the date when the end falls on another day). */
export function formatLondonTimeRange(start: string, end: string) {
  const sameDay = londonDateKey(start) === londonDateKey(end);
  return sameDay ? `${londonTimeKey(start)} to ${londonTimeKey(end)}` : `${londonTimeKey(start)} to ${formatDateKeyShort(londonDateKey(end))} ${londonTimeKey(end)}`;
}

export function rangeTitle(range: DiaryRange) {
  if (range.view === "day") return formatDateKeyLong(range.date);
  if (range.view === "month") return monthTitle.format(new Date(`${startOfMonth(range.date)}T12:00:00Z`));
  const last = addDays(range.end, -1);
  return `${formatDateKeyShort(range.start)} to ${formatDateKeyShort(last)} ${last.slice(0, 4)}`;
}

export function todayInLondon(now = new Date()) {
  return londonDateKey(now);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
