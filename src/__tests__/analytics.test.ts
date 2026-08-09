import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsProperties } from "@/lib/analytics/events";

describe("analytics privacy", () => {
  it("removes vehicle and contact properties", () => {
    expect(sanitizeAnalyticsProperties({ registration: "AB12CDE", phone: "07000000000", postcode: "DN6", source: "homepage", result: true })).toEqual({ source: "homepage", result: true });
  });
});
