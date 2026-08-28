export const BOOKING_TIME_ZONE = "Europe/London";

export function calendarDateInTimeZone(value: string | Date, timeZone = BOOKING_TIME_ZONE) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function slotBelongsToCalendarDate(start: string, date: string, timeZone = BOOKING_TIME_ZONE) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && calendarDateInTimeZone(start, timeZone) === date;
}

export function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
