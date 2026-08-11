import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = {
    booking: null as Row | null,
    events: new Map<string, Row>(),
    audits: [] as Row[],
    notifications: [] as unknown[],
    bookingUpdateError: null as Row | null,
  };

  function rowMatches(row: Row, filters: Array<[string, unknown]>) {
    return filters.every(([key, value]) => row[key] === value);
  }

  function builder(table: string) {
    let operation = "select";
    let payload: Row = {};
    const filters: Array<[string, unknown]> = [];
    const query: Record<string, unknown> & PromiseLike<unknown> = {
      select() { operation = "select"; return query; },
      eq(key: string, value: unknown) { filters.push([key, value]); return query; },
      update(value: Row) { operation = "update"; payload = value; return query; },
      delete() { operation = "delete"; return query; },
      async insert(value: Row) {
        if (table === "provider_webhook_events") {
          const key = String(value.event_key);
          if (state.events.has(key)) return { error: { code: "23505" } };
          state.events.set(key, { ...value });
          return { error: null };
        }
        if (table === "booking_audit_log") {
          state.audits.push({ id: state.audits.length + 1, created_at: new Date().toISOString(), ...value });
          return { error: null };
        }
        return { error: null };
      },
      async maybeSingle() {
        if (table !== "bookings" || !state.booking || !rowMatches(state.booking, filters)) return { data: null, error: null };
        return { data: { ...state.booking, booking_audit_log: [...state.audits] }, error: null };
      },
      then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        const execute = async () => {
          if (table === "bookings" && operation === "update" && state.booking && rowMatches(state.booking, filters)) {
            if (state.bookingUpdateError) return { error: state.bookingUpdateError };
            state.booking = { ...state.booking, ...payload };
            return { error: null };
          }
          if (table === "provider_webhook_events" && operation === "update") {
            const key = String(filters.find(([field]) => field === "event_key")?.[1] || "");
            const event = state.events.get(key);
            if (event) state.events.set(key, { ...event, ...payload });
            return { error: null };
          }
          if (table === "provider_webhook_events" && operation === "delete") {
            const key = String(filters.find(([field]) => field === "event_key")?.[1] || "");
            state.events.delete(key);
            return { error: null };
          }
          return { error: null };
        };
        return execute().then(onfulfilled, onrejected);
      },
    };
    return query;
  }

  const admin = { from: (table: string) => builder(table) };
  const sendNotification = vi.fn(async (...args: unknown[]) => {
    state.notifications.push(args);
    return true;
  });
  return { state, admin, sendNotification };
});

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => harness.admin }));
vi.mock("@/lib/bookings/notifications", () => ({ sendBookingNotification: harness.sendNotification }));

import { processCalComWebhook } from "@/lib/bookings/repository";
import type { CalComWebhook } from "@/lib/calcom/webhook";

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "70ca0b0b-1df7-42f4-8fe1-329c54ace42d",
    booking_reference: "SOB-123456",
    status: "pending",
    service_type_id: "service-id",
    service_key: "vehicle-diagnostics",
    service_name: "Vehicle Diagnostics",
    problem_description: "Intermittent warning light",
    appointment_start: "2026-08-18T08:00:00.000Z",
    appointment_end: "2026-08-18T09:00:00.000Z",
    original_appointment_start: "2026-08-18T08:00:00.000Z",
    original_appointment_end: "2026-08-18T09:00:00.000Z",
    timezone: "Europe/London",
    location_mode: "workshop",
    location: "SOB Autofix workshop",
    service_address: null,
    service_postcode: null,
    notes: null,
    cancellation_reason: null,
    cancelled_at: null,
    provider: "calcom",
    provider_booking_uid: null,
    provider_event_type_id: 123,
    provider_sync_state: "pending",
    provider_event_updated_at: null,
    provider_error_code: null,
    customers: { name: "Test Customer", email: "test@example.com", phone: "07000000000" },
    vehicles: { registration: "AB12CDE", make: "Vauxhall", model: "Astra", year: 2017, colour: "Blue", fuel_type: "Petrol", transmission: "Manual" },
    booking_audit_log: [],
    ...overrides,
  };
}

function event(triggerEvent: CalComWebhook["triggerEvent"], payload: CalComWebhook["payload"], createdAt = "2026-08-11T10:00:00.000Z"): CalComWebhook {
  return { triggerEvent, createdAt, payload };
}

describe("Cal.com webhook reconciliation", () => {
  beforeEach(() => {
    harness.state.booking = bookingRow();
    harness.state.events.clear();
    harness.state.audits.length = 0;
    harness.state.notifications.length = 0;
    harness.state.bookingUpdateError = null;
    harness.sendNotification.mockClear();
  });

  it("reconciles a created booking by safe SOB metadata", async () => {
    const payload = event("BOOKING_CREATED", {
      uid: "provider-uid",
      eventTypeId: 123,
      status: "ACCEPTED",
      startTime: "2026-08-18T08:00:00.000Z",
      endTime: "2026-08-18T09:00:00.000Z",
      metadata: { sobBookingId: harness.state.booking?.id, sobBookingReference: "SOB-123456" },
    });
    const result = await processCalComWebhook(payload, JSON.stringify(payload));
    expect(result).toMatchObject({ duplicate: false, outcome: "processed" });
    expect(harness.state.booking).toMatchObject({ provider_booking_uid: "provider-uid", status: "confirmed", provider_sync_state: "synced" });
    expect(harness.state.audits).toContainEqual(expect.objectContaining({ action: "confirmed", actor_type: "provider" }));
    expect(harness.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("deduplicates delivery of the exact same event", async () => {
    const payload = event("BOOKING_CREATED", { uid: "provider-uid", status: "ACCEPTED", metadata: { sobBookingId: harness.state.booking?.id } });
    const raw = JSON.stringify(payload);
    await processCalComWebhook(payload, raw);
    const duplicate = await processCalComWebhook(payload, raw);
    expect(duplicate).toEqual({ duplicate: true, outcome: "duplicate" });
    expect(harness.state.audits).toHaveLength(1);
    expect(harness.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("releases a failed event reservation so the provider can retry reconciliation", async () => {
    const payload = event("BOOKING_CREATED", {
      uid: "provider-uid",
      eventTypeId: 123,
      status: "ACCEPTED",
      startTime: "2026-08-18T08:00:00.000Z",
      endTime: "2026-08-18T09:00:00.000Z",
      metadata: { sobBookingId: harness.state.booking?.id, sobBookingReference: "SOB-123456" },
    });
    const raw = JSON.stringify(payload);
    harness.state.bookingUpdateError = { code: "database_unavailable" };

    await expect(processCalComWebhook(payload, raw)).rejects.toThrow("Webhook booking update failed");

    expect(harness.state.events).toHaveLength(0);
    expect(harness.state.booking).toMatchObject({
      status: "pending",
      provider_booking_uid: null,
      provider_sync_state: "pending",
    });
    expect(harness.state.audits).toHaveLength(0);
    expect(harness.sendNotification).not.toHaveBeenCalled();

    harness.state.bookingUpdateError = null;
    await expect(processCalComWebhook(payload, raw)).resolves.toEqual({
      duplicate: false,
      outcome: "processed",
    });
    expect(harness.state.events).toHaveLength(1);
    expect(harness.state.booking).toMatchObject({
      status: "confirmed",
      provider_booking_uid: "provider-uid",
      provider_sync_state: "synced",
    });
    expect(harness.state.audits).toContainEqual(expect.objectContaining({
      action: "confirmed",
      actor_type: "provider",
    }));
    expect(harness.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("retains original time and appends a reschedule history event", async () => {
    harness.state.booking = bookingRow({ provider_booking_uid: "old-uid", status: "confirmed" });
    const payload = event("BOOKING_RESCHEDULED", {
      uid: "new-uid",
      rescheduleUid: "old-uid",
      startTime: "2026-08-20T12:00:00.000Z",
      endTime: "2026-08-20T13:00:00.000Z",
      rescheduleStartTime: "2026-08-18T08:00:00.000Z",
      rescheduleEndTime: "2026-08-18T09:00:00.000Z",
    });
    await processCalComWebhook(payload, JSON.stringify(payload));
    expect(harness.state.booking).toMatchObject({
      provider_booking_uid: "new-uid",
      status: "rescheduled",
      appointment_start: "2026-08-20T12:00:00.000Z",
      original_appointment_start: "2026-08-18T08:00:00.000Z",
    });
    expect(harness.state.audits).toContainEqual(expect.objectContaining({
      action: "rescheduled",
      detail: expect.objectContaining({ previousAppointmentStart: "2026-08-18T08:00:00.000Z" }),
    }));
  });

  it("does not let an out-of-order create event overwrite newer state", async () => {
    harness.state.booking = bookingRow({
      provider_booking_uid: "provider-uid",
      status: "cancelled",
      provider_event_updated_at: "2026-08-12T10:00:00.000Z",
    });
    const payload = event("BOOKING_CREATED", { uid: "provider-uid", status: "ACCEPTED" }, "2026-08-11T10:00:00.000Z");
    const result = await processCalComWebhook(payload, JSON.stringify(payload));
    expect(result.outcome).toBe("ignored_out_of_order");
    expect(harness.state.booking?.status).toBe("cancelled");
    expect(harness.sendNotification).not.toHaveBeenCalled();
  });

  it("does not mutate an unrelated booking for an unknown UID", async () => {
    harness.state.booking = bookingRow({ provider_booking_uid: "known-uid", status: "confirmed" });
    const snapshot = { ...harness.state.booking };
    const payload = event("BOOKING_CANCELLED", { uid: "unknown-uid", cancellationReason: "Cancelled elsewhere" });
    const result = await processCalComWebhook(payload, JSON.stringify(payload));
    expect(result.outcome).toBe("unknown_booking");
    expect(harness.state.booking).toEqual(snapshot);
    expect(harness.state.audits).toHaveLength(0);
  });
});
