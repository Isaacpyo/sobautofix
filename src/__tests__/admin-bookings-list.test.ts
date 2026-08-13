import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin booking list", () => {
  it("uses a dedicated loading View action without a Time table column", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/page.tsx"), "utf8");
    expect(source).not.toContain(">Time</th>");
    expect(source).not.toContain(">Calendar sync</th>");
    expect(source).toContain(">View</BookingOpenLink>");
    expect(source).toContain('loadingTitle="Opening booking"');
  });
});
