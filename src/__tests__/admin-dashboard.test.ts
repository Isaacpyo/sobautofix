import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditEntityLabel,
  countStatuses,
  createSystemHealthChecks,
} from "@/lib/admin/dashboard";

const dashboardSource = readFileSync("src/app/admin/(protected)/page.tsx", "utf8");

describe("admin operations dashboard", () => {
  it("derives stock and content metrics from real status rows, including zero-data states", () => {
    expect(countStatuses([], ["available", "reserved", "sold"])).toEqual({ available: 0, reserved: 0, sold: 0 });
    expect(countStatuses(
      [{ status: "available" }, { status: "available" }, { status: "reserved" }, { status: "sold" }],
      ["available", "reserved", "sold"],
    )).toEqual({ available: 2, reserved: 1, sold: 1 });
    expect(countStatuses(
      [{ status: "published" }, { status: "draft" }, { status: "scheduled" }],
      ["published", "draft", "scheduled"],
    )).toEqual({ published: 1, draft: 1, scheduled: 1 });
  });

  it("uses the existing operational tables and recent-enquiry fields", () => {
    expect(dashboardSource).toContain('from("enquiries")');
    expect(dashboardSource).toContain('from("sale_vehicles")');
    expect(dashboardSource).toContain('from("content_entries")');
    expect(dashboardSource).toContain('from("admin_audit_log")');
    expect(dashboardSource).toContain("customers(name),vehicles(registration,make,model)");
    expect(dashboardSource).toContain("No enquiries yet");
    expect(dashboardSource).toContain("New website enquiries will appear here automatically.");
  });

  it("reports system health from actual readiness inputs", () => {
    const healthy = createSystemHealthChecks({
      websiteReady: true,
      databaseReady: true,
      emailReady: true,
      bookingReady: true,
      vehicleLookupReady: true,
    });
    expect(healthy.every((check) => check.state === "healthy")).toBe(true);

    const unavailable = createSystemHealthChecks({
      websiteReady: true,
      databaseReady: false,
      emailReady: false,
      bookingReady: false,
      vehicleLookupReady: false,
    });
    expect(unavailable.find((check) => check.label === "Database")?.status).toBe("Degraded");
    expect(unavailable.filter((check) => check.state !== "healthy")).toHaveLength(4);
  });

  it("turns audit records into meaningful activity labels", () => {
    expect(auditActionLabel("status_change", "enquiry")).toBe("Changed status of enquiry");
    expect(auditActionLabel("publish", "content")).toBe("Published content");
    expect(auditEntityLabel("content", { slug: "engine-management-light" })).toBe("engine management light");
  });

  it("derives appointment totals from local booking records", () => {
    expect(dashboardSource).toContain('from("bookings")');
    expect(dashboardSource).toContain("todayAppointments");
    expect(dashboardSource).toContain("upcomingBookings");
    expect(dashboardSource).toContain("provider_sync_state");
  });
});
