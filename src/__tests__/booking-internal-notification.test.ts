import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const events: Array<Record<string, unknown>> = [];
  const sends: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => ({
    async insert(value: Record<string, unknown>) {
      if (table === "booking_notification_events") events.push(value);
      return { error: null };
    },
    update() {
      return { async eq() { return { error: null }; } };
    },
  }));
  return { events, sends, from };
});

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ from: harness.from }) }));
vi.mock("@/lib/email/resend", () => ({ sendTransactionalEmail: vi.fn(async (message: Record<string, unknown>) => { harness.sends.push(message); return { data: { id: "provider-id" }, error: null }; }) }));

import { sendBookingNotification, type BookingNotificationDetails } from "@/lib/bookings/notifications";

const booking: BookingNotificationDetails = {
  id: "70ca0b0b-1df7-42f4-8fe1-329c54ace42d",
  reference: "SOB-123456",
  customerName: "Test Customer",
  customerEmail: "customer@example.com",
  customerPhone: "07000 000000",
  registration: "AB12CDE",
  vehicleName: "Vauxhall Astra",
  service: "Vehicle Diagnostic Assessment",
  appointmentStart: "2026-08-20T09:30:00.000Z",
  appointmentEnd: "2026-08-20T10:30:00.000Z",
  timezone: "Europe/London",
  location: "SOB Autofix workshop",
  calendarSequence: 0,
  calendarTimestamp: "2026-08-13T09:00:00.000Z",
  notes: "Intermittent warning light",
};

describe("internal booking email delivery", () => {
  beforeEach(() => {
    harness.events.length = 0;
    harness.sends.length = 0;
    harness.from.mockClear();
  });

  it("sends independent customer and internal messages with separate idempotency records", async () => {
    await expect(sendBookingNotification(booking, "confirmed")).resolves.toBe(true);
    expect(harness.sends).toHaveLength(2);
    expect(harness.sends).toEqual(expect.arrayContaining([
      expect.objectContaining({ to: "customer@example.com" }),
      expect.objectContaining({ from: "SOB Autofix <info@sobautofix.com>", to: "sobautofix@gmail.com", replyTo: "customer@example.com" }),
    ]));
    expect(harness.events.map((event) => event.notification_key)).toEqual(expect.arrayContaining(["SOB-123456:confirmed:once", "SOB-123456:confirmed:once:internal"]));
  });
});
