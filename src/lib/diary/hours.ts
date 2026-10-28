// Opening hours from Settings, used only as configured. SOB has often left
// them empty: then the diary shows a neutral full day and never warns about
// "outside hours". A day without a parseable "HH:mm–HH:mm" value is treated
// as unknown (no warning), not as closed.

import { parseOpeningHours } from "@/lib/settings/opening-hours";
import { londonDateKey, londonMinutesOfDay, weekdayIndex } from "./time";

export type DayHours = { open: string; close: string } | null;
/** Monday (0) to Sunday (6). */
export type WeeklyHours = DayHours[];

const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function parseWeeklyHours(openingHours: Partial<Record<string, string>> | null | undefined): WeeklyHours {
  return dayKeys.map((day) => {
    const value = openingHours?.[day];
    if (typeof value !== "string" || !value.trim()) return null;
    const { open, close } = parseOpeningHours(value);
    return open && close && close > open ? { open, close } : null;
  });
}

export function hoursConfigured(hours: WeeklyHours) {
  return hours.some(Boolean);
}

function minutes(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** Whole hours to draw: the configured opening span, or the full day when nothing is configured. */
export function gridHours(hours: WeeklyHours): { from: number; to: number } {
  const days = hours.filter((day): day is NonNullable<DayHours> => Boolean(day));
  if (!days.length) return { from: 0, to: 24 };
  return {
    from: Math.floor(Math.min(...days.map((day) => minutes(day.open))) / 60),
    to: Math.ceil(Math.max(...days.map((day) => minutes(day.close))) / 60),
  };
}

/**
 * Whether an appointment falls outside that day's configured hours. Null when
 * the day has no configured hours (nothing to compare with).
 */
export function outsideHours(start: string, end: string, hours: WeeklyHours): { open: string; close: string } | false | null {
  const date = londonDateKey(start);
  const day = hours[weekdayIndex(date)];
  if (!day) return null;
  const startMinutes = londonMinutesOfDay(start);
  const endMinutes = londonDateKey(end) === date ? londonMinutesOfDay(end) : 24 * 60;
  return startMinutes < minutes(day.open) || endMinutes > minutes(day.close) ? day : false;
}
