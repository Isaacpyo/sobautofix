// Viewing request times. Visitors pick a UK date and a daytime slot; the
// server converts it to an instant in Europe/London (handling the clock
// changes) and rejects anything in the past or outside the offered slots.
// Staff confirm every viewing, so these are requests, not bookings.

import { LONDON_TIME_ZONE } from "./format";

/** Hourly and half-hourly slots between 09:00 and 17:00 UK time. */
export const viewingSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"] as const;

/** How far ahead a viewing can be requested. */
export const VIEWING_WINDOW_DAYS = 28;

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar date in the UK for an instant, as YYYY-MM-DD. */
export function londonDateKey(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function offsetMinutes(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON_TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Convert a UK wall-clock date and time ("2026-10-31", "11:00") to an instant. */
export function londonWallTimeToInstant(date: string, time: string) {
  const dateMatch = datePattern.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hour, minute] = [Number(timeMatch[1]), Number(timeMatch[2])];
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(guess)) return null;
  // Two passes settle the offset either side of a clock change.
  let instant = guess - offsetMinutes(new Date(guess)) * 60_000;
  instant = guess - offsetMinutes(new Date(instant)) * 60_000;
  const result = new Date(instant);
  // Reject dates that do not exist (e.g. 31 February) by round-tripping.
  if (londonDateKey(result) !== date) return null;
  return result;
}

function addDays(date: string, days: number) {
  const match = datePattern.exec(date)!;
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days, 12));
  return value.toISOString().slice(0, 10);
}

function weekday(date: string) {
  const match = datePattern.exec(date)!;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)).getUTCDay();
}

/**
 * Dates a viewing can be requested for: from tomorrow (UK time) for
 * VIEWING_WINDOW_DAYS, Monday to Saturday. Staff confirm or suggest another
 * time, so no availability is promised here.
 */
export function viewingDates(now = new Date()) {
  const today = londonDateKey(now);
  const dates: string[] = [];
  for (let offset = 1; offset <= VIEWING_WINDOW_DAYS; offset += 1) {
    const date = addDays(today, offset);
    if (weekday(date) !== 0) dates.push(date);
  }
  return dates;
}

export function formatViewingDateOption(date: string) {
  const instant = londonWallTimeToInstant(date, "12:00");
  if (!instant) return date;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: LONDON_TIME_ZONE }).format(instant);
}

export type ViewingTimeResult = { ok: true; start: Date } | { ok: false; reason: string };

/** Validate a requested viewing time on the server. */
export function resolveViewingTime(date: string, time: string, now = new Date()): ViewingTimeResult {
  if (!viewingDates(now).includes(date)) return { ok: false, reason: "Choose a date from the list (Monday to Saturday, from tomorrow)." };
  if (!(viewingSlots as readonly string[]).includes(time)) return { ok: false, reason: "Choose a time from the list." };
  const start = londonWallTimeToInstant(date, time);
  if (!start || start.getTime() <= now.getTime()) return { ok: false, reason: "Choose a time in the future." };
  return { ok: true, start };
}
