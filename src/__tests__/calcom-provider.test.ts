import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAL_API_VERSIONS, CalComProvider } from "@/lib/calcom/client";
import { verifyCalComWebhook } from "@/lib/calcom/webhook";
import { SchedulingProviderError } from "@/lib/scheduling/provider";

function success(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status: "success", data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Cal.com API v2 adapter", () => {
  beforeEach(() => {
    process.env.CALCOM_API_KEY = "cal_live_test-only";
  });

  afterEach(() => {
    delete process.env.CALCOM_API_KEY;
    delete process.env.CALCOM_WEBHOOK_SECRET;
    vi.unstubAllGlobals();
  });

  it("keeps endpoint versions explicit and endpoint-specific", () => {
    expect(CAL_API_VERSIONS).toEqual({
      slots: "2024-09-04",
      createBooking: "2026-02-25",
      getBooking: "2026-02-25",
      rescheduleBooking: "2026-02-25",
      cancelBooking: "2026-02-25",
      webhooks: null,
    });
  });

  it("requests bounded event-type slots and normalises the response", async () => {
    const fetchMock = vi.fn(async () => success({
      "2026-08-18": [
        { start: "2026-08-18T08:00:00.000Z", end: "2026-08-18T09:00:00.000Z" },
        { start: "2026-08-18T10:00:00.000Z" },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const slots = await new CalComProvider().getAvailableSlots({
      eventTypeId: 123,
      start: "2026-08-18",
      end: "2026-08-19",
      timeZone: "Europe/London",
      bookingUidToReschedule: "current-booking",
    });

    expect(slots).toEqual([
      { start: "2026-08-18T08:00:00.000Z", end: "2026-08-18T09:00:00.000Z" },
      { start: "2026-08-18T10:00:00.000Z", end: undefined },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v2/slots?");
    expect(url).toContain("eventTypeId=123");
    expect(url).toContain("bookingUidToReschedule=current-booking");
    expect(new Headers(init.headers).get("cal-api-version")).toBe("2024-09-04");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer cal_live_test-only");
  });

  it("creates an ordinary booking with only safe correlation metadata", async () => {
    const fetchMock = vi.fn(async () => success({
      uid: "provider-uid",
      status: "accepted",
      start: "2026-08-18T08:00:00.000Z",
      end: "2026-08-18T09:00:00.000Z",
      eventType: { id: 123 },
      metadata: { sobBookingId: "local-id", sobBookingReference: "SOB-123456" },
    }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const booking = await new CalComProvider().createBooking({
      eventTypeId: 123,
      start: "2026-08-18T08:00:00.000Z",
      attendee: { name: "Test Customer", email: "test@example.com", timeZone: "Europe/London", phoneNumber: "+447000000000" },
      metadata: { sobBookingId: "local-id", sobBookingReference: "SOB-123456" },
    });

    expect(booking.uid).toBe("provider-uid");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cal.com/v2/bookings");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("cal-api-version")).toBe("2026-02-25");
    expect(JSON.parse(String(init.body))).toMatchObject({
      eventTypeId: 123,
      attendee: { email: "test@example.com", language: "en" },
      metadata: { sobBookingReference: "SOB-123456" },
    });
  });

  it("uses the in-place reschedule endpoint and start body", async () => {
    const fetchMock = vi.fn(async () => success({ uid: "new-uid", status: "accepted", start: "2026-08-20T09:00:00.000Z" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await new CalComProvider().rescheduleBooking("old uid", "2026-08-20T09:00:00.000Z", "Customer requested");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cal.com/v2/bookings/old%20uid/reschedule");
    expect(JSON.parse(String(init.body))).toEqual({ start: "2026-08-20T09:00:00.000Z", reschedulingReason: "Customer requested" });
  });

  it("uses the in-place cancellation endpoint", async () => {
    const fetchMock = vi.fn(async () => success({ uid: "booking-uid", status: "cancelled", start: "2026-08-20T09:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);
    const booking = await new CalComProvider().cancelBooking("booking-uid", "Customer requested");
    expect(booking.status).toBe("cancelled");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cal.com/v2/bookings/booking-uid/cancel");
    expect(JSON.parse(String(init.body))).toEqual({ cancellationReason: "Customer requested" });
  });

  it("maps a provider conflict to a slot-unavailable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "error", error: { code: "slot_taken" } }), { status: 409 })));
    await expect(new CalComProvider().createBooking({
      eventTypeId: 123,
      start: "2026-08-18T08:00:00.000Z",
      attendee: { name: "Test", email: "test@example.com", timeZone: "Europe/London" },
      metadata: {},
    })).rejects.toMatchObject({ code: "slot_unavailable", status: 409 } satisfies Partial<SchedulingProviderError>);
  });

  it("verifies the exact raw webhook body using the documented signature header value", () => {
    process.env.CALCOM_WEBHOOK_SECRET = "webhook-test-secret";
    const raw = '{"triggerEvent":"BOOKING_CREATED","payload":{"uid":"abc"}}';
    const signature = createHmac("sha256", process.env.CALCOM_WEBHOOK_SECRET).update(raw).digest("hex");
    expect(verifyCalComWebhook(raw, signature)).toBe(true);
    expect(verifyCalComWebhook(`${raw} `, signature)).toBe(false);
    expect(verifyCalComWebhook(raw, `sha256=${signature}`)).toBe(false);
  });
});
