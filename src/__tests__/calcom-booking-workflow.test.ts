import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter =
    | { kind: "eq"; field: string; value: unknown }
    | { kind: "in"; field: string; values: unknown[] };

  const state = {
    booking: null as Row | null,
    audits: [] as Row[],
    intents: new Map<string, { booking_id: string; booking_reference: string }>(),
    notificationEvents: new Map<string, Row>(),
    sequence: [] as string[],
    bookingUpdateError: null as Row | null,
  };

  function fieldValue(row: Row, field: string) {
    const [relationName, relationField] = field.split(".");
    if (!relationField) return row[field];
    if (!relationName) return undefined;
    const relation = row[relationName];
    const related = Array.isArray(relation) ? relation[0] : relation;
    return related && typeof related === "object" ? (related as Row)[relationField] : undefined;
  }

  function rowMatches(row: Row, filters: Filter[]) {
    return filters.every((filter) => {
      const value = fieldValue(row, filter.field);
      if (filter.kind === "eq") return value === filter.value;
      return filter.values.includes(value);
    });
  }

  function builder(table: string) {
    let operation = "select";
    let payload: Row = {};
    const filters: Filter[] = [];
    const query: Record<string, unknown> & PromiseLike<unknown> = {
      select() {
        operation = "select";
        return query;
      },
      eq(field: string, value: unknown) {
        filters.push({ kind: "eq", field, value });
        return query;
      },
      in(field: string, values: unknown[]) {
        filters.push({ kind: "in", field, values });
        return query;
      },
      update(value: Row) {
        operation = "update";
        payload = value;
        return query;
      },
      async insert(value: Row) {
        if (table === "booking_audit_log") {
          state.audits.push({
            id: state.audits.length + 1,
            created_at: new Date(Date.UTC(2026, 7, 11, 10, state.audits.length)).toISOString(),
            ...value,
          });
          return { error: null };
        }
        if (table === "booking_notification_events") {
          const key = String(value.notification_key);
          if (state.notificationEvents.has(key)) return { error: { code: "23505" } };
          state.notificationEvents.set(key, { ...value });
          return { error: null };
        }
        return { error: null };
      },
      async maybeSingle() {
        if (table !== "bookings" || !state.booking || !rowMatches(state.booking, filters)) {
          return { data: null, error: null };
        }
        const bookingId = state.booking.id;
        return {
          data: {
            ...state.booking,
            booking_audit_log: state.audits.filter((audit) => audit.booking_id === bookingId),
          },
          error: null,
        };
      },
      then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        const execute = async () => {
          if (table === "bookings" && operation === "update" && state.booking && rowMatches(state.booking, filters)) {
            state.sequence.push("local:update");
            if (state.bookingUpdateError) return { error: state.bookingUpdateError };
            state.booking = { ...state.booking, ...payload };
            return { error: null };
          }
          if (table === "booking_notification_events" && operation === "update") {
            const keyFilter = filters.find((filter) => filter.kind === "eq" && filter.field === "notification_key");
            const key = keyFilter?.kind === "eq" ? String(keyFilter.value) : "";
            const event = state.notificationEvents.get(key);
            if (event) state.notificationEvents.set(key, { ...event, ...payload });
            return { error: null };
          }
          return { error: null };
        };
        return execute().then(onfulfilled, onrejected);
      },
    };
    return query;
  }

  const from = vi.fn((table: string) => builder(table));
  const rpc = vi.fn(async (_name: string, params: Row) => {
    const idempotencyKey = String(params.p_idempotency_key);
    const existing = state.intents.get(idempotencyKey);
    if (existing) return { data: [{ ...existing, created: false }], error: null };
    if (!state.booking) return { data: null, error: { code: "missing_test_booking" } };
    const intent = {
      booking_id: String(state.booking.id),
      booking_reference: String(state.booking.booking_reference),
    };
    state.intents.set(idempotencyKey, intent);
    return { data: [{ ...intent, created: true }], error: null };
  });
  const admin = { from, rpc };
  const provider = {
    getAvailableSlots: vi.fn(),
    createBooking: vi.fn(),
    getBooking: vi.fn(),
    rescheduleBooking: vi.fn(),
    cancelBooking: vi.fn(),
  };
  const getBookableService = vi.fn();
  const getAvailableRescheduleSlots = vi.fn();
  const sendNotification = vi.fn();
  const sendEmail = vi.fn();

  return {
    state,
    admin,
    provider,
    getBookableService,
    getAvailableRescheduleSlots,
    sendNotification,
    sendEmail,
  };
});

vi.mock("@/lib/calcom/client", () => ({ getSchedulingProvider: () => harness.provider }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => harness.admin }));
vi.mock("@/lib/bookings/services", () => ({
  bookingTimezone: () => "Europe/London",
  getBookableService: harness.getBookableService,
  getAvailableRescheduleSlots: harness.getAvailableRescheduleSlots,
}));
vi.mock("@/lib/bookings/notifications", () => ({ sendBookingNotification: harness.sendNotification }));
vi.mock("@/lib/email/resend", () => ({ sendTransactionalEmail: harness.sendEmail }));

import {
  BookingWorkflowError,
  cancelBooking,
  createBooking,
  findBooking,
  rescheduleBooking,
} from "@/lib/bookings/repository";
import type { CreateBookingInput } from "@/lib/bookings/schema";
import { SchedulingProviderError } from "@/lib/scheduling/provider";

const bookingId = "70ca0b0b-1df7-42f4-8fe1-329c54ace42d";
const idempotencyKey = "f5898238-32a1-4764-b57b-529fa953c941";
const originalStart = "2026-08-18T08:00:00.000Z";

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: bookingId,
    booking_reference: "SOB-123456",
    status: "pending",
    service_type_id: "service-id",
    service_key: "vehicle-diagnostics",
    service_name: "Vehicle Diagnostics",
    problem_description: "Intermittent warning light",
    appointment_start: originalStart,
    appointment_end: "2026-08-18T09:00:00.000Z",
    original_appointment_start: originalStart,
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
    vehicles: {
      registration: "AB12CDE",
      make: "Vauxhall",
      model: "Astra",
      year: 2017,
      colour: "Blue",
      fuel_type: "Petrol",
      transmission: "Manual",
    },
    booking_audit_log: [],
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    vehicle: {
      registration: "AB12CDE",
      make: "Vauxhall",
      model: "Astra",
      year: 2017,
      colour: "Blue",
      fuelType: "Petrol",
      transmission: "Manual",
    },
    serviceKey: "vehicle-diagnostics",
    problemDescription: "The warning light appears intermittently.",
    symptoms: ["warning light"],
    conditionalAnswers: { warningLight: "Engine management" },
    location: { mode: "workshop", address: "", postcode: "" },
    customer: { name: "Test Customer", email: "test@example.com", phone: "07000 000000" },
    appointmentStart: originalStart,
    idempotencyKey,
    ...overrides,
  };
}

describe("Cal.com booking repository workflows", () => {
  beforeEach(() => {
    harness.state.booking = bookingRow();
    harness.state.audits.length = 0;
    harness.state.intents.clear();
    harness.state.notificationEvents.clear();
    harness.state.sequence.length = 0;
    harness.state.bookingUpdateError = null;
    harness.admin.from.mockClear();
    harness.admin.rpc.mockClear();
    harness.getBookableService.mockReset().mockResolvedValue({
      id: "service-id",
      key: "vehicle-diagnostics",
      name: "Vehicle Diagnostics",
      description: "Diagnostic investigation",
      provider: "calcom",
      providerEventTypeId: 123,
      locationMode: "workshop",
    });
    harness.getAvailableRescheduleSlots.mockReset();
    harness.provider.getAvailableSlots.mockReset().mockResolvedValue([{ start: originalStart }]);
    harness.provider.createBooking.mockReset().mockResolvedValue({
      uid: "provider-uid",
      status: "accepted",
      start: originalStart,
      end: "2026-08-18T09:00:00.000Z",
      eventTypeId: 456,
      metadata: {},
    });
    harness.provider.getBooking.mockReset();
    harness.provider.rescheduleBooking.mockReset();
    harness.provider.cancelBooking.mockReset();
    harness.sendNotification.mockReset().mockResolvedValue(true);
    harness.sendEmail.mockReset().mockResolvedValue(true);
  });

  it("persists a successful provider create and returns the existing booking on an idempotent retry", async () => {
    const input = createInput();

    const first = await createBooking(input);
    const retry = await createBooking(input);

    expect(first).toMatchObject({
      reference: "SOB-123456",
      status: "confirmed",
      appointmentStart: originalStart,
    });
    expect(retry).toEqual(first);
    expect(harness.provider.getAvailableSlots).toHaveBeenCalledWith({
      eventTypeId: 123,
      start: "2026-08-18",
      end: "2026-08-19",
      timeZone: "Europe/London",
    });
    expect(harness.admin.rpc).toHaveBeenCalledTimes(2);
    expect(harness.admin.rpc).toHaveBeenCalledWith("create_booking_intent", expect.objectContaining({
      p_idempotency_key: idempotencyKey,
      p_appointment_start: originalStart,
    }));
    expect(harness.provider.createBooking).toHaveBeenCalledTimes(1);
    expect(harness.provider.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      eventTypeId: 123,
      start: originalStart,
      metadata: { sobBookingId: bookingId, sobBookingReference: "SOB-123456" },
    }));
    expect(harness.state.booking).toMatchObject({
      provider_booking_uid: "provider-uid",
      provider_event_type_id: 456,
      provider_sync_state: "synced",
      provider_error_code: null,
      status: "confirmed",
      original_appointment_start: originalStart,
    });
    expect(harness.state.audits).toEqual([
      expect.objectContaining({
        booking_id: bookingId,
        action: "confirmed",
        actor_type: "provider",
        detail: { appointmentStart: originalStart },
      }),
    ]);
    expect(harness.sendNotification).toHaveBeenCalledTimes(1);
    expect(harness.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      id: bookingId,
      reference: "SOB-123456",
      appointmentStart: originalStart,
    }), "confirmed");
  });

  it("rechecks the selected create slot and stops before reserving an unavailable time", async () => {
    harness.provider.getAvailableSlots.mockResolvedValue([{ start: "2026-08-18T10:00:00.000Z" }]);

    await expect(createBooking(createInput())).rejects.toMatchObject({
      name: "BookingWorkflowError",
      code: "slot_unavailable",
    } satisfies Partial<BookingWorkflowError>);

    expect(harness.provider.getAvailableSlots).toHaveBeenCalledTimes(1);
    expect(harness.admin.rpc).not.toHaveBeenCalled();
    expect(harness.provider.createBooking).not.toHaveBeenCalled();
    expect(harness.sendNotification).not.toHaveBeenCalled();
  });

  it("records failed provider creation without presenting the local intent as synced", async () => {
    harness.provider.createBooking.mockRejectedValue(
      new SchedulingProviderError("Calendar temporarily unavailable", "unavailable", 503),
    );

    await expect(createBooking(createInput())).rejects.toMatchObject({
      name: "BookingWorkflowError",
      code: "provider_unavailable",
    } satisfies Partial<BookingWorkflowError>);

    expect(harness.state.booking).toMatchObject({
      status: "pending",
      provider_booking_uid: null,
      provider_sync_state: "failed",
      provider_error_code: "provider_unavailable",
    });
    expect(harness.state.audits).toEqual([
      expect.objectContaining({
        booking_id: bookingId,
        action: "provider_sync_failed",
        actor_type: "system",
        detail: { operation: "create", code: "provider_unavailable" },
      }),
    ]);
    expect(harness.sendNotification).not.toHaveBeenCalled();
  });

  it("keeps a provider-created appointment pending reconciliation when the local update fails", async () => {
    harness.state.bookingUpdateError = { code: "database_unavailable" };

    await expect(createBooking(createInput())).rejects.toMatchObject({
      name: "BookingWorkflowError",
      code: "persistence",
      message: "Your appointment was created but SOB-123456 needs calendar reconciliation. Please contact SOB Autofix.",
    } satisfies Partial<BookingWorkflowError>);

    expect(harness.provider.createBooking).toHaveBeenCalledTimes(1);
    expect(harness.provider.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { sobBookingId: bookingId, sobBookingReference: "SOB-123456" },
    }));
    expect(harness.state.booking).toMatchObject({
      status: "pending",
      provider_booking_uid: null,
      provider_sync_state: "pending",
      provider_error_code: null,
    });
    expect(harness.state.audits).toHaveLength(0);
    expect(harness.sendNotification).not.toHaveBeenCalled();

    await expect(createBooking(createInput())).rejects.toMatchObject({
      name: "BookingWorkflowError",
      code: "processing",
    } satisfies Partial<BookingWorkflowError>);
    expect(harness.provider.createBooking).toHaveBeenCalledTimes(1);
  });

  it("requires both management lookup factors to match the same booking", async () => {
    const lookup = {
      bookingReference: "SOB-123456",
      registration: "AB12CDE",
    };

    await expect(findBooking(lookup)).resolves.toMatchObject({
      id: bookingId,
      booking: { reference: "SOB-123456" },
    });
    await expect(findBooking({ ...lookup, registration: "XY99ZZZ" })).resolves.toBeNull();
  });

  it("rechecks a reschedule against the current provider UID and preserves booking history", async () => {
    const requestedStart = "2026-08-20T09:00:00+01:00";
    const providerStart = "2026-08-20T08:00:00.000Z";
    harness.state.booking = bookingRow({
      status: "confirmed",
      provider_booking_uid: "old-provider-uid",
    });
    harness.state.audits.push({
      id: 1,
      booking_id: bookingId,
      action: "confirmed",
      actor_type: "provider",
      detail: { appointmentStart: originalStart },
      created_at: "2026-08-11T09:00:00.000Z",
    });
    harness.provider.getAvailableSlots.mockResolvedValue([{ start: providerStart }]);
    harness.provider.rescheduleBooking.mockResolvedValue({
      uid: "new-provider-uid",
      status: "accepted",
      start: providerStart,
      end: "2026-08-20T09:00:00.000Z",
      eventTypeId: 123,
      metadata: {},
    });

    const result = await rescheduleBooking(bookingId, requestedStart);

    expect(harness.provider.getAvailableSlots).toHaveBeenCalledWith({
      eventTypeId: 123,
      bookingUidToReschedule: "old-provider-uid",
      start: "2026-08-20",
      end: "2026-08-21",
      timeZone: "Europe/London",
    });
    expect(harness.provider.rescheduleBooking).toHaveBeenCalledWith(
      "old-provider-uid",
      requestedStart,
      "Customer requested reschedule through SOB Autofix",
    );
    expect(harness.state.booking).toMatchObject({
      provider_booking_uid: "new-provider-uid",
      status: "rescheduled",
      appointment_start: providerStart,
      original_appointment_start: originalStart,
      provider_sync_state: "synced",
    });
    expect(harness.state.audits.at(-1)).toMatchObject({
      action: "rescheduled",
      actor_type: "customer",
      detail: {
        previousAppointmentStart: originalStart,
        appointmentStart: providerStart,
        providerResult: "synced",
      },
    });
    expect(result).toMatchObject({
      outcome: "rescheduled",
      booking: {
        status: "rescheduled",
        appointmentStart: providerStart,
        originalAppointmentStart: originalStart,
        history: [
          { action: "confirmed", appointmentStart: originalStart },
          {
            action: "rescheduled",
            previousAppointmentStart: originalStart,
            appointmentStart: providerStart,
          },
        ],
      },
    });
    expect(harness.sendNotification).toHaveBeenCalledTimes(1);
    expect(harness.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentStart: providerStart }),
      "rescheduled",
    );
  });

  it("cancels with the provider before applying the local terminal state", async () => {
    harness.state.booking = bookingRow({
      status: "confirmed",
      provider_booking_uid: "provider-uid",
    });
    harness.provider.cancelBooking.mockImplementation(async () => {
      harness.state.sequence.push("provider:cancel");
      return {
        uid: "provider-uid",
        status: "cancelled",
        start: originalStart,
        metadata: {},
      };
    });

    const result = await cancelBooking(bookingId);

    expect(harness.state.sequence.slice(0, 2)).toEqual(["provider:cancel", "local:update"]);
    expect(harness.provider.cancelBooking).toHaveBeenCalledWith(
      "provider-uid",
      "Customer requested cancellation through SOB Autofix",
    );
    expect(harness.state.booking).toMatchObject({
      status: "cancelled",
      cancellation_reason: "Customer requested cancellation through SOB Autofix",
      provider_sync_state: "synced",
      provider_error_code: null,
    });
    expect(harness.state.audits.at(-1)).toMatchObject({
      action: "cancelled",
      actor_type: "customer",
      detail: expect.objectContaining({
        previousStatus: "confirmed",
        providerResult: "synced",
      }),
    });
    expect(result).toMatchObject({ outcome: "cancelled", booking: { status: "cancelled" } });
    expect(harness.sendNotification).toHaveBeenCalledTimes(1);
    expect(harness.sendNotification).toHaveBeenCalledWith(expect.any(Object), "cancelled");
  });

  it("leaves local state untouched when provider cancellation fails", async () => {
    harness.state.booking = bookingRow({
      status: "confirmed",
      provider_booking_uid: "provider-uid",
    });
    harness.provider.cancelBooking.mockImplementation(async () => {
      harness.state.sequence.push("provider:cancel");
      throw new SchedulingProviderError("Provider rejected cancellation", "unavailable", 503);
    });

    await expect(cancelBooking(bookingId)).rejects.toMatchObject({ code: "unavailable" });

    expect(harness.state.sequence).toEqual(["provider:cancel"]);
    expect(harness.state.booking).toMatchObject({ status: "confirmed", provider_sync_state: "pending" });
    expect(harness.state.audits).toHaveLength(0);
    expect(harness.sendNotification).not.toHaveBeenCalled();
  });

  it("does not offer or call the provider to reschedule a cancelled booking", async () => {
    harness.state.booking = bookingRow({
      status: "cancelled",
      provider_booking_uid: "provider-uid",
      cancellation_reason: "Customer cancelled",
      cancelled_at: "2026-08-12T10:00:00.000Z",
    });

    const result = await rescheduleBooking(bookingId, "2026-08-20T09:00:00+01:00");

    expect(result).toMatchObject({
      outcome: "ineligible",
      booking: {
        status: "cancelled",
        canModify: false,
        modificationMessage: "This appointment has already been cancelled and can no longer be changed online.",
      },
    });
    expect(harness.provider.getAvailableSlots).not.toHaveBeenCalled();
    expect(harness.provider.rescheduleBooking).not.toHaveBeenCalled();
    expect(harness.state.audits).toHaveLength(0);
    expect(harness.sendNotification).not.toHaveBeenCalled();
  });

  it("deduplicates reschedule notifications that express the same instant with different offsets", async () => {
    const { sendBookingNotification } = await vi.importActual<typeof import("@/lib/bookings/notifications")>(
      "@/lib/bookings/notifications",
    );
    const details = {
      id: bookingId,
      reference: "SOB-123456",
      customerName: "Test Customer",
      customerEmail: "test@example.com",
      registration: "AB12CDE",
      vehicleName: "Vauxhall Astra",
      service: "Vehicle Diagnostics",
      appointmentStart: "2026-08-20T09:00:00+01:00",
      appointmentEnd: "2026-08-20T10:00:00+01:00",
      timezone: "Europe/London",
      location: "SOB Autofix workshop",
      calendarSequence: 1,
      calendarTimestamp: "2026-08-13T09:00:00.000Z",
    };

    await sendBookingNotification(details, "rescheduled");
    await sendBookingNotification({ ...details, appointmentStart: "2026-08-20T08:00:00.000Z" }, "rescheduled");

    expect(harness.state.notificationEvents).toHaveLength(1);
    expect(harness.sendEmail).toHaveBeenCalledTimes(1);
    const message = harness.sendEmail.mock.calls[0]?.[0];
    expect(message.attachments).toHaveLength(1);
    expect(message.replyTo).toBe("info@sobautofix.com");
    expect(message.attachments[0].filename).toBe("SOB-123456.ics");
    expect(message.attachments[0].content.toString("utf8")).toContain("UID:SOB-123456@sobautofix.com");
    expect(message.html).toContain("Add to Google Calendar");
    expect(message.html).toContain("Add to Calendar");
  });
});
