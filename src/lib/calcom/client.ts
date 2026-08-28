import "server-only";

import {
  SchedulingProviderError,
  type AvailableSlot,
  type CreateSchedulingBookingRequest,
  type SchedulingBooking,
  type SchedulingProvider,
  type SlotRequest,
} from "@/lib/scheduling/provider";

export const CALCOM_API_ORIGIN = "https://api.cal.com";

export const CAL_API_VERSIONS = {
  slots: "2024-09-04",
  createBooking: "2026-02-25",
  getBooking: "2026-02-25",
  rescheduleBooking: "2026-02-25",
  cancelBooking: "2026-02-25",
  webhooks: null,
} as const;

type CalComBooking = {
  uid?: string;
  status?: string;
  start?: string;
  end?: string;
  eventType?: { id?: number };
  eventTypeId?: number;
  location?: string | { type?: string; address?: string } | null;
  metadata?: Record<string, unknown> | null;
};

type CalComEnvelope<T> = {
  status?: string;
  data?: T;
  error?: { code?: string; message?: string } | string;
  message?: string;
};

function apiKey() {
  return process.env.CALCOM_API_KEY?.trim();
}

export function isCalComConfigured() {
  return Boolean(apiKey());
}

function safeErrorCode(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const value = body as CalComEnvelope<unknown>;
  if (typeof value.error === "object" && typeof value.error?.code === "string") return value.error.code.slice(0, 80);
  return undefined;
}

function providerError(operation: string, status: number, body: unknown) {
  const providerCode = safeErrorCode(body);
  console.error("Scheduling provider request failed", { provider: "calcom", operation, status, providerCode });
  if (status === 401 || status === 403) return new SchedulingProviderError("Booking provider authentication failed", "configuration", status);
  if (status === 404) return new SchedulingProviderError("Booking was not found", "not_found", status);
  if (status === 409) return new SchedulingProviderError("The selected appointment is no longer available", "slot_unavailable", status);
  if (status === 429) return new SchedulingProviderError("The booking provider is temporarily busy", "rate_limited", status);
  if (status >= 500) return new SchedulingProviderError("The booking provider is temporarily unavailable", "unavailable", status);
  return new SchedulingProviderError("The booking provider rejected the request", "invalid_request", status);
}

async function request<T>(
  operation: keyof typeof CAL_API_VERSIONS,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = apiKey();
  if (!token) throw new SchedulingProviderError("The booking provider is not configured", "configuration");
  const version = CAL_API_VERSIONS[operation];
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (version) headers.set("cal-api-version", version);

  let response: Response;
  try {
    response = await fetch(`${CALCOM_API_ORIGIN}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new SchedulingProviderError("The booking provider is temporarily unavailable", "unavailable");
  }

  const body = await response.json().catch(() => null) as CalComEnvelope<T> | null;
  if (!response.ok) throw providerError(operation, response.status, body);
  if (!body || body.status !== "success" || body.data === undefined) {
    throw new SchedulingProviderError("The booking provider returned an invalid response", "unavailable", response.status);
  }
  return body.data;
}

function normalizeStatus(value: string | undefined): SchedulingBooking["status"] {
  const status = value?.toLowerCase();
  if (status === "accepted" || status === "pending" || status === "cancelled" || status === "rejected") return status;
  return "unknown";
}

function locationLabel(value: CalComBooking["location"]) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.address;
}

function stringMetadata(value: CalComBooking["metadata"]) {
  return Object.fromEntries(
    Object.entries(value || {}).flatMap(([key, item]) => typeof item === "string" ? [[key, item]] : []),
  );
}

function normalizeBooking(value: CalComBooking | CalComBooking[]): SchedulingBooking {
  const booking = Array.isArray(value) ? value[0] : value;
  if (!booking?.uid || !booking.start) {
    throw new SchedulingProviderError("The booking provider returned an invalid booking", "unavailable");
  }
  return {
    uid: booking.uid,
    status: normalizeStatus(booking.status),
    start: booking.start,
    end: booking.end,
    eventTypeId: booking.eventType?.id ?? booking.eventTypeId,
    location: locationLabel(booking.location),
    metadata: stringMetadata(booking.metadata),
  };
}

function normalizeSlots(
  value: Record<string, Array<string | { start?: string; end?: string }>>,
  start: string,
  end: string,
): AvailableSlot[] {
  return Object.entries(value)
    .filter(([date]) => date >= start && date < end)
    .flatMap(([, slots]) => slots)
    .flatMap((slot) => {
      if (typeof slot === "string") return [{ start: slot }];
      return slot.start ? [{ start: slot.start, end: slot.end }] : [];
    })
    .sort((left, right) => left.start.localeCompare(right.start));
}

export class CalComProvider implements SchedulingProvider {
  async getAvailableSlots(input: SlotRequest) {
    const params = new URLSearchParams({
      eventTypeId: String(input.eventTypeId),
      start: input.start,
      end: input.end,
      timeZone: input.timeZone,
      format: "range",
    });
    if (input.bookingUidToReschedule) params.set("bookingUidToReschedule", input.bookingUidToReschedule);
    const data = await request<Record<string, Array<string | { start?: string; end?: string }>>>("slots", `/v2/slots?${params}`);
    return normalizeSlots(data, input.start, input.end);
  }

  async createBooking(input: CreateSchedulingBookingRequest) {
    const attendee = {
      name: input.attendee.name,
      email: input.attendee.email,
      timeZone: input.attendee.timeZone,
      language: "en",
      ...(input.attendee.phoneNumber ? { phoneNumber: input.attendee.phoneNumber } : {}),
    };
    const data = await request<CalComBooking | CalComBooking[]>("createBooking", "/v2/bookings", {
      method: "POST",
      body: JSON.stringify({
        start: input.start,
        eventTypeId: input.eventTypeId,
        attendee,
        metadata: input.metadata,
        ...(input.attendeeAddress ? { location: { type: "attendeeAddress", address: input.attendeeAddress } } : {}),
      }),
    });
    return normalizeBooking(data);
  }

  async getBooking(bookingUid: string) {
    const data = await request<CalComBooking | CalComBooking[]>("getBooking", `/v2/bookings/${encodeURIComponent(bookingUid)}`);
    return normalizeBooking(data);
  }

  async rescheduleBooking(bookingUid: string, start: string, reason?: string) {
    const data = await request<CalComBooking | CalComBooking[]>("rescheduleBooking", `/v2/bookings/${encodeURIComponent(bookingUid)}/reschedule`, {
      method: "POST",
      body: JSON.stringify({ start, ...(reason ? { reschedulingReason: reason } : {}) }),
    });
    return normalizeBooking(data);
  }

  async cancelBooking(bookingUid: string, reason?: string) {
    const data = await request<CalComBooking | CalComBooking[]>("cancelBooking", `/v2/bookings/${encodeURIComponent(bookingUid)}/cancel`, {
      method: "POST",
      body: JSON.stringify(reason ? { cancellationReason: reason } : {}),
    });
    return normalizeBooking(data);
  }
}

export function getSchedulingProvider(): SchedulingProvider {
  if (!isCalComConfigured()) throw new SchedulingProviderError("The booking provider is not configured", "configuration");
  return new CalComProvider();
}

