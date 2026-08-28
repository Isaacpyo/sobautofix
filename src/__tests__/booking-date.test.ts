import { describe, expect, it } from "vitest";
import { addCalendarDays, calendarDateInTimeZone, slotBelongsToCalendarDate } from "@/lib/bookings/date";

describe("booking calendar dates", () => {
  it.each([
    ["same day in British Summer Time", "2026-08-26T13:00:00.000Z", "2026-08-26"],
    ["next day", "2026-08-27T13:00:00.000Z", "2026-08-27"],
    ["future winter date", "2026-11-18T14:00:00.000Z", "2026-11-18"],
    ["DST start date", "2026-03-29T13:00:00.000Z", "2026-03-29"],
    ["DST end date", "2026-10-25T14:00:00.000Z", "2026-10-25"],
  ])("preserves the %s as a Europe/London calendar date", (_, start, expected) => {
    expect(calendarDateInTimeZone(start)).toBe(expected);
    expect(slotBelongsToCalendarDate(start, expected)).toBe(true);
  });

  it("rejects a provider slot that rolled into tomorrow", () => {
    expect(slotBelongsToCalendarDate("2026-08-27T13:00:00.000Z", "2026-08-26")).toBe(false);
  });

  it.each([
    ["2026-08-31", 1, "2026-09-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-03-29", 1, "2026-03-30"],
    ["2026-10-25", -1, "2026-10-24"],
  ])("navigates date-only values from %s without timezone rollover", (date, days, expected) => {
    expect(addCalendarDays(date, days)).toBe(expected);
  });
});
