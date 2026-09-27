import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin notifications", () => {
  it("counts new bookings and booking delivery or calendar issues alongside enquiry alerts", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/admin/notifications.ts"), "utf8");
    expect(source).toContain('client.from("bookings")');
    expect(source).toContain("admin_seen_at.is.null");
    expect(source).toContain("provider_sync_state.in.(pending,failed)");
    expect(source).toContain('client.from("booking_notification_events")');
    expect(source).toContain("enquiryIds.size + bookingIds.size + unmatchedCount");
  });

  it("polls the authenticated count endpoint and sends the live count to both badges", () => {
    const source = readFileSync(join(process.cwd(), "src/components/admin/admin-shell.tsx"), "utf8");
    expect(source).toContain('fetch("/api/admin/notifications/count"');
    expect(source).toContain("window.setInterval");
    expect(source).toContain("notificationCount={liveNotificationCount}");
  });

  it("shows booking alerts in the notification centre and acknowledges them on open", () => {
    const notifications = readFileSync(join(process.cwd(), "src/app/admin/(protected)/notifications/page.tsx"), "utf8");
    const bookingPage = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/[id]/page.tsx"), "utf8");
    const actions = readFileSync(join(process.cwd(), "src/app/admin/(protected)/bookings/actions.ts"), "utf8");
    expect(notifications).toContain("New booking awaiting review");
    expect(notifications).toContain("Booking email delivery failed");
    expect(notifications).toContain("Calendar sync failed");
    expect(bookingPage).toContain("<MarkBookingSeen");
    expect(actions).toContain("export async function markBookingSeenAction");
    expect(actions).toContain("admin_seen_at: new Date().toISOString()");
  });

  it("backfills old bookings as reviewed while leaving recent and future bookings visible", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260927125345_track_booking_admin_notifications.sql"), "utf8");
    expect(migration).toContain("add column if not exists admin_seen_at timestamptz");
    expect(migration).toContain("created_at < now() - interval '24 hours'");
    expect(migration).toContain("where admin_seen_at is null");
  });
});
