import { describe, expect, it } from "vitest";
import { bookingNotificationKey, type BookingNotificationDetails } from "@/lib/bookings/notifications";

const booking: BookingNotificationDetails = {
  id: "70ca0b0b-1df7-42f4-8fe1-329c54ace42d",
  reference: "SOB-123456",
  customerName: "Test Customer",
  customerEmail: "customer@example.com",
  registration: "AB12CDE",
  vehicleName: "Vauxhall Astra",
  service: "Vehicle Diagnostics",
  appointmentStart: "2026-08-20T09:30:00.000Z",
  location: "SOB Autofix workshop",
};

describe("booking email notification keys", () => {
  it.each(["confirmed", "rescheduled", "cancelled"] as const)("is stable for %s retries", (type) => {
    expect(bookingNotificationKey(booking, type)).toBe(bookingNotificationKey({ ...booking }, type));
  });

  it("versions reschedules by appointment while keeping one confirmation and cancellation event", () => {
    const changed = { ...booking, appointmentStart: "2026-08-21T09:30:00.000Z" };
    expect(bookingNotificationKey(booking, "rescheduled")).not.toBe(bookingNotificationKey(changed, "rescheduled"));
    expect(bookingNotificationKey(booking, "confirmed")).toBe(bookingNotificationKey(changed, "confirmed"));
    expect(bookingNotificationKey(booking, "cancelled")).toBe(bookingNotificationKey(changed, "cancelled"));
  });
});
