import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMileage, orNotConfirmed, writeOffBadge } from "@/lib/exchange/public/format";
import { londonDateKey, londonWallTimeToInstant, resolveViewingTime, viewingDates } from "@/lib/exchange/public/viewing-time";

describe("UK viewing times", () => {
  it("converts UK wall-clock times either side of the clock changes", () => {
    // British Summer Time (UTC+1) ends at 02:00 on 25 October 2026.
    expect(londonWallTimeToInstant("2026-10-24", "11:00")?.toISOString()).toBe("2026-10-24T10:00:00.000Z");
    expect(londonWallTimeToInstant("2026-10-26", "11:00")?.toISOString()).toBe("2026-10-26T11:00:00.000Z");
    // It starts again at 01:00 on 28 March 2027.
    expect(londonWallTimeToInstant("2027-03-27", "09:30")?.toISOString()).toBe("2027-03-27T09:30:00.000Z");
    expect(londonWallTimeToInstant("2027-03-29", "09:30")?.toISOString()).toBe("2027-03-29T08:30:00.000Z");
  });

  it("rejects impossible dates", () => {
    expect(londonWallTimeToInstant("2026-02-31", "10:00")).toBeNull();
    expect(londonWallTimeToInstant("31/10/2026", "10:00")).toBeNull();
  });

  it("offers Monday to Saturday from tomorrow for four weeks", () => {
    const now = new Date("2026-10-28T20:00:00Z"); // Wednesday evening
    const dates = viewingDates(now);
    expect(dates[0]).toBe("2026-10-29");
    expect(dates).not.toContain("2026-11-01"); // Sunday
    expect(dates).not.toContain(londonDateKey(now));
    expect(dates.length).toBe(24);
  });

  it("only accepts offered future slots", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    expect(resolveViewingTime("2026-10-31", "11:00", now)).toEqual({ ok: true, start: new Date("2026-10-31T11:00:00Z") });
    expect(resolveViewingTime("2026-10-28", "15:00", now).ok).toBe(false); // today
    expect(resolveViewingTime("2026-11-01", "11:00", now).ok).toBe(false); // Sunday
    expect(resolveViewingTime("2026-10-31", "11:15", now).ok).toBe(false); // not a slot
    expect(resolveViewingTime("2026-10-31", "20:00", now).ok).toBe(false); // evening
    expect(resolveViewingTime("2027-01-31", "11:00", now).ok).toBe(false); // too far ahead
  });
});

describe("listing formatting", () => {
  it("shows Not confirmed for unknown facts instead of guessing", () => {
    expect(orNotConfirmed(undefined)).toBe("Not confirmed");
    expect(orNotConfirmed("  ")).toBe("Not confirmed");
    expect(orNotConfirmed(0)).toBe("0");
    expect(formatDate(undefined)).toBe("Not confirmed");
    expect(formatDate("2027-06-14")).toBe("14 June 2027");
  });

  it("labels recorded write-offs and formats UK times", () => {
    expect(writeOffBadge("cat_n")).toBe("Cat N recorded");
    expect(writeOffBadge("none_recorded")).toBeNull();
    expect(writeOffBadge("not_confirmed")).toBeNull();
    expect(formatMileage(41250)).toBe("41,250 miles");
    expect(formatDateTime("2026-10-31T11:00:00Z")).toBe("Saturday 31 October 2026 at 11:00");
  });
});
