import { describe, expect, it } from "vitest";
import { renderBookingEmail } from "@/lib/email/templates/bookings";

const booking = {
  customerName: "Test Customer",
  reference: "SOB-123456",
  service: "Vehicle Diagnostics",
  vehicle: "AB12 CDE · Vauxhall Astra",
  date: "Thursday, 20 August 2026",
  startTime: "09:30",
  endTime: "10:30",
  duration: "60 minutes",
  timezone: "Europe/London (UK time)",
  location: "SOB Autofix workshop",
  previousAppointment: "Tuesday, 18 August 2026 at 09:30–10:30",
  googleCalendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
  calendarUrl: "https://sobautofix.com/api/bookings/calendar/SOB-123456?signature=test",
};

describe("SOB Autofix booking email content", () => {
  it("includes complete appointment details and SOB-owned calendar actions", () => {
    const rendered = renderBookingEmail({ ...booking, type: "confirmed" });
    for (const value of ["Test Customer", "AB12 CDE", "Vehicle Diagnostics", "Thursday, 20 August 2026", "09:30", "10:30", "60 minutes", "Europe/London", "SOB-123456"]) {
      expect(rendered.html).toContain(value);
    }
    expect(rendered.html).toContain("Manage booking");
    expect(rendered.html).toContain("Add to Google Calendar");
    expect(rendered.html).toContain("Add to Calendar");
    expect(rendered.html).not.toContain("Cal.com");
  });

  it("makes the new appointment dominant and shows the previous time secondarily", () => {
    const rendered = renderBookingEmail({ ...booking, type: "rescheduled" });
    expect(rendered.html).toContain("Your appointment has been rescheduled.");
    expect(rendered.html).toContain("Previous appointment");
    expect(rendered.html).toContain(booking.previousAppointment);
    expect(rendered.html).toContain("Add to Google Calendar");
  });

  it("removes active calendar actions from the cancellation message", () => {
    const rendered = renderBookingEmail({ ...booking, type: "cancelled" });
    expect(rendered.html).toContain("BOOKING CANCELLED");
    expect(rendered.html).toContain("Book another appointment");
    expect(rendered.html).not.toContain(">Manage booking<");
    expect(rendered.html).not.toContain("Add to Google Calendar");
    expect(rendered.html).not.toContain(">Add to Calendar<");
  });
});
