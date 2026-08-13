import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bookingCalendarDownloadUrl,
  bookingCalendarUid,
  buildBookingCalendar,
  buildGoogleCalendarUrl,
  verifyBookingCalendarSignature,
  type BookingCalendarDetails,
} from "@/lib/bookings/calendar";

const booking: BookingCalendarDetails = {
  reference: "SOB-123456",
  customerName: "Test Customer",
  customerEmail: "customer@example.com",
  service: "Vehicle Diagnostics",
  vehicle: "AB12 CDE · Vauxhall Astra",
  appointmentStart: "2026-08-20T08:30:00.000Z",
  appointmentEnd: "2026-08-20T09:30:00.000Z",
  timezone: "Europe/London",
  location: "SOB Autofix workshop",
  sequence: 0,
  status: "confirmed",
  timestamp: "2026-08-13T09:00:00.000Z",
};

describe("SOB Autofix booking calendars", () => {
  beforeEach(() => {
    process.env.BOOKING_MANAGEMENT_SECRET = "calendar-test-secret-with-high-entropy";
  });

  afterEach(() => {
    delete process.env.BOOKING_MANAGEMENT_SECRET;
  });

  it("uses one stable branded UID for booking, reschedule and cancellation", () => {
    expect(bookingCalendarUid(booking.reference)).toBe("SOB-123456@sobautofix.com");
    expect(buildBookingCalendar(booking)).toContain("UID:SOB-123456@sobautofix.com");
    expect(buildBookingCalendar({ ...booking, status: "rescheduled", sequence: 1 })).toContain("UID:SOB-123456@sobautofix.com");
    expect(buildBookingCalendar({ ...booking, status: "cancelled", sequence: 2 })).toContain("UID:SOB-123456@sobautofix.com");
  });

  it("generates valid CRLF calendar data with correct BST instants", () => {
    const calendar = buildBookingCalendar(booking);
    expect(calendar).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(calendar).toContain("METHOD:REQUEST\r\n");
    expect(calendar).toContain("X-WR-TIMEZONE:Europe/London\r\n");
    expect(calendar).toContain("DTSTART:20260820T083000Z\r\n");
    expect(calendar).toContain("DTEND:20260820T093000Z\r\n");
    expect(calendar).toContain("SUMMARY:Vehicle Diagnostics — SOB Autofix\r\n");
    expect(calendar).toContain("ORGANIZER;CN=SOB Autofix:mailto:notifications@sobautofix.com\r\n");
    expect(calendar).toContain("ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:customer@example.com\r\n");
    expect(calendar).not.toContain("Cal.com");
  });

  it("uses cancellation semantics for the same calendar event", () => {
    const calendar = buildBookingCalendar({ ...booking, status: "cancelled", sequence: 2 });
    expect(calendar).toContain("METHOD:CANCEL\r\n");
    expect(calendar).toContain("SEQUENCE:2\r\n");
    expect(calendar).toContain("STATUS:CANCELLED\r\n");
  });

  it("builds a direct Google Calendar action from authoritative booking data", () => {
    const url = new URL(buildGoogleCalendarUrl(booking));
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20260820T083000Z/20260820T093000Z");
    expect(url.searchParams.get("ctz")).toBe("Europe/London");
    expect(url.searchParams.get("details")).toContain("SOB-123456");
    expect(url.toString()).not.toContain("cal.com");
  });

  it("signs calendar downloads without exposing a reusable management token", () => {
    const url = new URL(bookingCalendarDownloadUrl(booking.reference)!);
    const signature = url.searchParams.get("signature");
    expect(url.pathname).toBe("/api/bookings/calendar/SOB-123456");
    expect(verifyBookingCalendarSignature(booking.reference, signature)).toBe(true);
    expect(verifyBookingCalendarSignature("SOB-654321", signature)).toBe(false);
    expect(url.toString()).not.toContain("bookingId");
  });
});
