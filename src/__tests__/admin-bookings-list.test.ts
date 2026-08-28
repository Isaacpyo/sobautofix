import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin booking list", () => {
  it("orders appointments by newest booking first", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/page.tsx"), "utf8");
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).not.toContain('.order("appointment_start", { ascending: false })');
  });

  it("links summary cards to list views and preserves the view while filtering and paging", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/page.tsx"), "utf8");
    expect(source).toContain('view: "today"');
    expect(source).toContain('view: "upcoming"');
    expect(source).toContain('view: "attention"');
    expect(source).toContain('href={view === metric.view ? "/admin/bookings"');
    expect(source).toContain('additionalParams={{ view }}');
    expect(source).toContain("matchesBookingView(booking, view");
  });

  it("uses a dedicated loading View action without a Time table column", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/page.tsx"), "utf8");
    expect(source).not.toContain(">Time</th>");
    expect(source).not.toContain(">Calendar sync</th>");
    expect(source).toContain(">View</BookingOpenLink>");
    expect(source).toContain('loadingTitle="Opening booking"');
  });

  it("orders by date booked and keeps location details off list views", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/page.tsx"), "utf8");
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain(">Date booked</th>");
    expect(source).toContain("Bookings are ordered by date booked, newest to oldest.");
    expect(source).not.toContain('ListDetail label="Location"');
    expect(source).not.toContain(">Location</th>");
  });

  it("links every booking summary metric to its filtered list", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/page.tsx"), "utf8");
    for (const view of ["today", "upcoming", "attention", "completed", "cancelled"]) {
      expect(source).toContain(`view: "${view}"`);
    }
    expect(source).toContain("matchesBookingView(booking, view");
  });
});
