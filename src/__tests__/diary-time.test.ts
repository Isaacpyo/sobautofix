import { describe, expect, it } from "vitest";
import { appointmentTimes, addMinutesToTime, parseStartParam } from "@/lib/diary/schema";
import {
  addMonths,
  clockChangeNote,
  diaryRange,
  formatLondonTimeRange,
  londonDateKey,
  londonDayLengthHours,
  londonMidnight,
  londonMinutesOfDay,
  londonTimeKey,
  londonToUtc,
  rangeTitle,
  shiftDiaryDate,
  startOfWeek,
} from "@/lib/diary/time";

describe("London wall clock to UTC", () => {
  it("uses GMT in winter and BST in summer", () => {
    expect(londonToUtc("2026-01-15", "09:00")?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(londonToUtc("2026-07-15", "09:00")?.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("handles the spring-forward day, 29 March 2026", () => {
    expect(londonToUtc("2026-03-29", "00:30")?.toISOString()).toBe("2026-03-29T00:30:00.000Z");
    // 01:00 to 01:59 does not exist: the clocks jump from 01:00 GMT to 02:00 BST.
    expect(londonToUtc("2026-03-29", "01:30")).toBeNull();
    expect(clockChangeNote("2026-03-29", "01:30")).toBe("skipped");
    expect(londonToUtc("2026-03-29", "02:00")?.toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(londonToUtc("2026-03-29", "09:00")?.toISOString()).toBe("2026-03-29T08:00:00.000Z");
    expect(londonDayLengthHours("2026-03-29")).toBe(23);
  });

  it("handles the fall-back day, 25 October 2026", () => {
    // 01:30 happens twice: first in BST (00:30 UTC), then in GMT (01:30 UTC).
    expect(londonToUtc("2026-10-25", "01:30")?.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(londonToUtc("2026-10-25", "01:30", { occurrence: "later" })?.toISOString()).toBe("2026-10-25T01:30:00.000Z");
    expect(clockChangeNote("2026-10-25", "01:30")).toBe("repeated");
    expect(clockChangeNote("2026-10-25", "09:00")).toBeNull();
    expect(londonToUtc("2026-10-25", "09:00")?.toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(londonToUtc("2026-10-24", "09:00")?.toISOString()).toBe("2026-10-24T08:00:00.000Z");
    expect(londonDayLengthHours("2026-10-25")).toBe(25);
  });

  it("rejects invalid dates and times", () => {
    expect(londonToUtc("2026-02-30", "09:00")).toBeNull();
    expect(londonToUtc("2026-02-10", "24:00")).toBeNull();
    expect(londonToUtc("not a date", "09:00")).toBeNull();
  });
});

describe("UTC to London", () => {
  it("puts late-evening summer instants on the next London day", () => {
    expect(londonDateKey("2026-06-30T23:30:00Z")).toBe("2026-07-01");
    expect(londonTimeKey("2026-06-30T23:30:00Z")).toBe("00:30");
    expect(londonDateKey("2026-12-31T23:30:00Z")).toBe("2026-12-31");
  });

  it("measures minutes of the London day across the clock change", () => {
    expect(londonMinutesOfDay("2026-03-29T08:00:00Z")).toBe(9 * 60);
    expect(londonMinutesOfDay("2026-10-25T09:00:00Z")).toBe(9 * 60);
  });

  it("formats time ranges in London time", () => {
    expect(formatLondonTimeRange("2026-07-15T08:00:00Z", "2026-07-15T08:45:00Z")).toBe("09:00 to 09:45");
  });
});

describe("diary ranges", () => {
  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-28")).toBe("2026-10-26");
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(startOfWeek("2026-10-26")).toBe("2026-10-26");
  });

  it("covers the week containing the fall-back day with the right UTC bounds", () => {
    const range = diaryRange("week", "2026-10-25");
    expect(range).toMatchObject({ start: "2026-10-19", end: "2026-10-26" });
    expect(range.startUtc).toBe("2026-10-18T23:00:00.000Z");
    expect(range.endUtc).toBe("2026-10-26T00:00:00.000Z");
  });

  it("covers the spring-forward day with a 23-hour range", () => {
    const range = diaryRange("day", "2026-03-29");
    expect(range.startUtc).toBe("2026-03-29T00:00:00.000Z");
    expect(range.endUtc).toBe("2026-03-29T23:00:00.000Z");
  });

  it("shows whole weeks in a month view", () => {
    const range = diaryRange("month", "2026-10-28");
    expect(range.start).toBe("2026-09-28");
    expect(range.end).toBe("2026-11-02");
    expect(rangeTitle(range)).toBe("October 2026");
  });

  it("shows seven days from the chosen date in the agenda", () => {
    expect(diaryRange("agenda", "2026-10-28")).toMatchObject({ start: "2026-10-28", end: "2026-11-04" });
  });

  it("pages by the size of each view", () => {
    expect(shiftDiaryDate("day", "2026-10-28", 1)).toBe("2026-10-29");
    expect(shiftDiaryDate("week", "2026-10-28", -1)).toBe("2026-10-21");
    expect(shiftDiaryDate("month", "2026-10-28", 1)).toBe("2026-11-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("has UTC midnights that match the London offset", () => {
    expect(londonMidnight("2026-07-01").toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(londonMidnight("2026-12-01").toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("appointment form times", () => {
  it("converts the form's date and times to UTC", () => {
    expect(appointmentTimes("2026-07-15", "10:00", "10:45")).toEqual({ ok: true, times: { start: "2026-07-15T09:00:00.000Z", end: "2026-07-15T09:45:00.000Z" } });
  });

  it("refuses a start time skipped by the clocks going forward", () => {
    const result = appointmentTimes("2026-03-29", "01:15", "02:30");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result).toMatchObject({ field: "startTime" });
  });

  it("spans the clock change correctly on 29 March 2026", () => {
    // 00:30 GMT to 02:30 BST is one hour of real time.
    expect(appointmentTimes("2026-03-29", "00:30", "02:30")).toEqual({ ok: true, times: { start: "2026-03-29T00:30:00.000Z", end: "2026-03-29T01:30:00.000Z" } });
  });

  it("ends a repeated hour on its later occurrence when needed on 25 October 2026", () => {
    // 01:45 BST to 01:15 (the second, GMT, one) is a 30-minute appointment.
    expect(appointmentTimes("2026-10-25", "01:45", "01:15")).toEqual({ ok: true, times: { start: "2026-10-25T00:45:00.000Z", end: "2026-10-25T01:15:00.000Z" } });
    expect(appointmentTimes("2026-10-25", "00:30", "02:30")).toEqual({ ok: true, times: { start: "2026-10-24T23:30:00.000Z", end: "2026-10-25T02:30:00.000Z" } });
  });

  it("requires the end to be after the start", () => {
    expect(appointmentTimes("2026-07-15", "10:00", "10:00")).toMatchObject({ ok: false, field: "endTime" });
    expect(appointmentTimes("2026-07-15", "10:00", "09:00")).toMatchObject({ ok: false, field: "endTime" });
  });

  it("reads the start query parameter and adds minutes", () => {
    expect(parseStartParam("2026-10-30T11:00", "2026-10-28")).toEqual({ date: "2026-10-30", time: "11:00" });
    expect(parseStartParam("2026-10-30", "2026-10-28")).toEqual({ date: "2026-10-30", time: "09:00" });
    expect(parseStartParam("garbage", "2026-10-28")).toEqual({ date: "2026-10-28", time: "09:00" });
    expect(addMinutesToTime("09:30", 45)).toBe("10:15");
    expect(addMinutesToTime("23:30", 60)).toBe("23:59");
  });
});
