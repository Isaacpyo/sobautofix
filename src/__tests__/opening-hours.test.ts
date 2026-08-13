import { describe, expect, it } from "vitest";
import { formatOpeningHours, openingTimeOptions, parseOpeningHours } from "@/lib/settings/opening-hours";

describe("opening-hours settings", () => {
  it("offers half-hour choices from 06:00 through 21:00", () => {
    expect(openingTimeOptions.at(0)).toBe("06:00");
    expect(openingTimeOptions.at(-1)).toBe("21:00");
    expect(openingTimeOptions).toHaveLength(31);
  });

  it("keeps blank hours unpublished and formats complete selections", () => {
    expect(formatOpeningHours(null, "")).toBe("");
    expect(formatOpeningHours("09:00", "17:00")).toBe("09:00–17:00");
    expect(parseOpeningHours("09:00–17:00")).toEqual({ open: "09:00", close: "17:00" });
  });

  it("rejects incomplete or reversed hours", () => {
    expect(() => formatOpeningHours("09:00", "")).toThrow(/both opening and closing/);
    expect(() => formatOpeningHours("17:00", "09:00")).toThrow(/later than opening/);
  });
});
