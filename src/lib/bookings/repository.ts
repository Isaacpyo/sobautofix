import "server-only";

import { createHash } from "node:crypto";
import { getSchedulingProvider } from "@/lib/calcom/client";
import type { CalComWebhook } from "@/lib/calcom/webhook";
import { siteConfig } from "@/config/site";
import { SchedulingProviderError } from "@/lib/scheduling/provider";
import { createAdminClient } from "@/lib/supabase/server";
import { formatRegistration } from "@/lib/vehicle/registration-format";
import { addCalendarDays, calendarDateInTimeZone, slotBelongsToCalendarDate } from "./date";
import { sendBookingNotification, type BookingNotificationDetails } from "./notifications";
import { bookingTimezone, getAvailableRescheduleSlots, getBookableService } from "./services";
import type { BookingLookupInput, CreateBookingInput } from "./schema";
import type { BookingConfirmation, BookingHistoryEntry, BookingStatus, ProviderSyncState, PublicBooking } from "./types";

type AuditRow = {
  id: number;
  action: string;
  actor_type: "customer" | "provider" | "admin" | "system";
  detail: unknown;
  created_at: string;
};

type BookingRow = {
  id: string;
  booking_reference: string;
  status: BookingStatus;
  service_type_id: string | null;
  service_key: string | null;
  service_name: string;
  problem_description: string | null;
  appointment_start: string;
  appointment_end: string | null;
  original_appointment_start: string;
  original_appointment_end: string | null;
  timezone: string;
  location_mode: "workshop" | "mobile" | null;
  location: string | null;
  service_address: string | null;
  service_postcode: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  provider: string;
  provider_booking_uid: string | null;
  provider_event_type_id: number | null;
  provider_sync_state: ProviderSyncState;
  provider_event_updated_at: string | null;
  provider_error_code: string | null;
  customers: { name: string; email: string | null; phone: string } | Array<{ name: string; email: string | null; phone: string }> | null;
  vehicles: {
    registration: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    colour: string | null;
    fuel_type: string | null;
    transmission: string | null;
  } | Array<{
    registration: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    colour: string | null;
    fuel_type: string | null;
    transmission: string | null;
  }> | null;
  booking_audit_log: AuditRow[] | null;
};

const modifiableStatuses: BookingStatus[] = ["pending", "confirmed", "rescheduled"];
const bookingSelect = "id,booking_reference,status,service_type_id,service_key,service_name,problem_description,appointment_start,appointment_end,original_appointment_start,original_appointment_end,timezone,location_mode,location,service_address,service_postcode,notes,cancellation_reason,cancelled_at,provider,provider_booking_uid,provider_event_type_id,provider_sync_state,provider_event_updated_at,provider_error_code,customers!inner(name,email,phone),vehicles!inner(registration,make,model,year,colour,fuel_type,transmission),booking_audit_log(id,action,actor_type,detail,created_at)";

export type BookingWorkflowErrorCode = "slot_unavailable" | "service_unavailable" | "provider_unavailable" | "processing" | "persistence";

export class BookingWorkflowError extends Error {
  constructor(message: string, public readonly code: BookingWorkflowErrorCode) {
    super(message);
    this.name = "BookingWorkflowError";
  }
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

function auditDetail(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function historyFor(row: BookingRow): BookingHistoryEntry[] {
  return (row.booking_audit_log || [])
    .map((entry) => {
      const detail = auditDetail(entry.detail);
      return {
        id: entry.id,
        action: entry.action,
        actor: entry.actor_type,
        createdAt: entry.created_at,
        previousAppointmentStart: typeof detail.previousAppointmentStart === "string" ? detail.previousAppointmentStart : undefined,
        previousAppointmentEnd: typeof detail.previousAppointmentEnd === "string" ? detail.previousAppointmentEnd : undefined,
        appointmentStart: typeof detail.appointmentStart === "string" ? detail.appointmentStart : undefined,
        appointmentEnd: typeof detail.appointmentEnd === "string" ? detail.appointmentEnd : undefined,
      };
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function bookingModificationMessage(status: BookingStatus) {
  if (status === "completed") return "This appointment has already been completed and can no longer be changed online.";
  if (status === "cancelled") return "This appointment has already been cancelled and can no longer be changed online.";
  return undefined;
}

function toPublicBooking(row: BookingRow): PublicBooking {
  const customer = relation(row.customers);
  const vehicle = relation(row.vehicles);
  const providerReady = row.provider === "calcom" && Boolean(row.provider_booking_uid && row.provider_event_type_id);
  const statusMessage = bookingModificationMessage(row.status);
  return {
    reference: row.booking_reference,
    status: row.status,
    customerName: customer?.name || "Customer",
    registration: formatRegistration(vehicle?.registration || ""),
    vehicleName: [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || undefined,
    service: row.service_name,
    appointmentStart: row.appointment_start,
    originalAppointmentStart: row.original_appointment_start,
    timezone: row.timezone,
    location: row.location || undefined,
    notes: row.problem_description || row.notes || undefined,
    history: historyFor(row),
    canModify: modifiableStatuses.includes(row.status) && providerReady,
    modificationMessage: statusMessage || (!providerReady ? "Please contact SOB Autofix to change this booking." : undefined),
  };
}

function workshopLocation() {
  const address = siteConfig.address;
  return [address.building, address.street, address.town, address.city, address.postcode].filter(Boolean).join(", ");
}

function bookingLocation(input: CreateBookingInput["location"]) {
  return input.mode === "mobile" ? [input.address, input.postcode].filter(Boolean).join(", ") : workshopLocation();
}

function vehicleLabel(row: BookingRow) {
  const vehicle = relation(row.vehicles);
  return [formatRegistration(vehicle?.registration || ""), vehicle?.make, vehicle?.model].filter(Boolean).join(" · ");
}

function notificationDetails(row: BookingRow): BookingNotificationDetails | null {
  const customer = relation(row.customers);
  const vehicle = relation(row.vehicles);
  if (!customer?.email) return null;
  const history = historyFor(row);
  const previousAppointment = [...history].reverse().find((entry) => entry.action === "rescheduled" && entry.previousAppointmentStart);
  const calendarSequence = history.filter((entry) => entry.action === "rescheduled" || entry.action === "cancelled").length;
  const latestCalendarEvent = [...history].reverse().find((entry) => ["confirmed", "rescheduled", "cancelled"].includes(entry.action));
  return {
    id: row.id,
    reference: row.booking_reference,
    customerName: customer.name,
    customerEmail: customer.email,
    registration: vehicle?.registration || "",
    vehicleName: [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || undefined,
    service: row.service_name,
    appointmentStart: row.appointment_start,
    appointmentEnd: row.appointment_end || undefined,
    timezone: row.timezone,
    location: row.location || "SOB Autofix workshop",
    previousAppointmentStart: previousAppointment?.previousAppointmentStart,
    previousAppointmentEnd: previousAppointment?.previousAppointmentEnd,
    calendarSequence,
    calendarTimestamp: latestCalendarEvent?.createdAt || row.provider_event_updated_at || row.appointment_start,
  };
}

export async function getBookingCalendarNotification(reference: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("bookings").select(bookingSelect).eq("booking_reference", reference).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as BookingRow;
  if (!(["confirmed", "rescheduled", "cancelled"] as BookingStatus[]).includes(row.status)) return null;
  const details = notificationDetails(row);
  if (!details?.appointmentEnd) return null;
  const type = row.status === "cancelled" ? "cancelled" as const : row.status === "rescheduled" ? "rescheduled" as const : "confirmed" as const;
  return { details, type };
}

function toConfirmation(row: BookingRow): BookingConfirmation {
  const customer = relation(row.customers);
  return {
    reference: row.booking_reference,
    status: row.status,
    appointmentStart: row.appointment_start,
    service: row.service_name,
    vehicle: vehicleLabel(row),
    location: row.location || "SOB Autofix workshop",
    email: customer?.email || "",
  };
}

async function getBookingById(id: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("bookings").select(bookingSelect).eq("id", id).maybeSingle();
  return error || !data ? null : data as unknown as BookingRow;
}

async function recordAudit(bookingId: string, action: string, actor: AuditRow["actor_type"], detail: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.from("booking_audit_log").insert({ booking_id: bookingId, action, actor_type: actor, detail });
  return !error;
}

export async function findBooking(input: BookingLookupInput) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("bookings")
    .select(bookingSelect)
    .eq("booking_reference", input.bookingReference)
    .eq("vehicles.registration", input.registration)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as BookingRow;
  return { id: row.id, booking: toPublicBooking(row) };
}

function providerPhone(value: string) {
  const digits = value.replace(/[^0-9+]/g, "");
  if (/^0\d{9,10}$/.test(digits)) return `+44${digits.slice(1)}`;
  if (digits.startsWith("0044")) return `+44${digits.slice(4)}`;
  return /^\+[1-9]\d{6,14}$/.test(digits) ? digits : undefined;
}

function workflowError(error: unknown): BookingWorkflowError {
  if (error instanceof BookingWorkflowError) return error;
  if (error instanceof SchedulingProviderError) {
    if (error.code === "slot_unavailable" || error.code === "invalid_request") {
      return new BookingWorkflowError("That appointment time has just become unavailable. Please choose another time.", "slot_unavailable");
    }
    return new BookingWorkflowError("Online appointment availability is temporarily unavailable.", "provider_unavailable");
  }
  return new BookingWorkflowError("We couldn't complete this booking. Please try again.", "persistence");
}

export async function createBooking(input: CreateBookingInput): Promise<BookingConfirmation> {
  const service = await getBookableService(input.serviceKey, input.location.mode);
  if (!service) throw new BookingWorkflowError("This service is not currently available for online booking.", "service_unavailable");
  const timeZone = bookingTimezone();
  const provider = getSchedulingProvider();
  const selectedDate = calendarDateInTimeZone(input.appointmentStart, timeZone);
  if (!selectedDate) throw new BookingWorkflowError("Choose a valid appointment date and time.", "slot_unavailable");

  try {
    const currentSlots = await provider.getAvailableSlots({
      eventTypeId: service.providerEventTypeId,
      start: selectedDate,
      end: addCalendarDays(selectedDate, 1),
      timeZone,
    });
    const selectedTime = new Date(input.appointmentStart).getTime();
    if (!currentSlots.some((slot) => slotBelongsToCalendarDate(slot.start, selectedDate, timeZone) && new Date(slot.start).getTime() === selectedTime)) {
      throw new BookingWorkflowError("That appointment time has just become unavailable. Please choose another time.", "slot_unavailable");
    }
  } catch (error) {
    throw workflowError(error);
  }

  const admin = createAdminClient();
  if (!admin) throw new BookingWorkflowError("The booking service is not configured.", "persistence");
  const location = bookingLocation(input.location);
  const { data: intentData, error: intentError } = await admin.rpc("create_booking_intent", {
    p_idempotency_key: input.idempotencyKey,
    p_customer_name: input.customer.name,
    p_customer_email: input.customer.email,
    p_customer_phone: input.customer.phone,
    p_registration: input.vehicle.registration,
    p_vehicle_make: input.vehicle.make || "",
    p_vehicle_model: input.vehicle.model || "",
    p_vehicle_year: input.vehicle.year || null,
    p_vehicle_colour: input.vehicle.colour || "",
    p_vehicle_fuel_type: input.vehicle.fuelType || "",
    p_vehicle_transmission: input.vehicle.transmission || "",
    p_service_type_id: service.id,
    p_service_key: service.key,
    p_service_name: service.name,
    p_problem_description: input.problemDescription,
    p_symptoms: input.symptoms,
    p_conditional_answers: input.conditionalAnswers,
    p_location_mode: input.location.mode,
    p_location: location,
    p_service_address: input.location.address || "",
    p_service_postcode: input.location.postcode || "",
    p_appointment_start: input.appointmentStart,
    p_timezone: timeZone,
  });
  const intent = Array.isArray(intentData) ? intentData[0] : intentData;
  if (intentError || !intent?.booking_id || !intent?.booking_reference) {
    throw new BookingWorkflowError("We couldn't safely reserve this booking. Please try again.", "persistence");
  }

  if (!intent.created) {
    const existing = await getBookingById(intent.booking_id);
    if (existing?.provider_booking_uid && ["pending", "confirmed", "rescheduled"].includes(existing.status)) return toConfirmation(existing);
    throw new BookingWorkflowError("This booking request is already being processed. Please wait before trying again.", "processing");
  }

  let providerBooking;
  try {
    providerBooking = await provider.createBooking({
      eventTypeId: service.providerEventTypeId,
      start: input.appointmentStart,
      attendee: {
        name: input.customer.name,
        email: input.customer.email,
        phoneNumber: providerPhone(input.customer.phone),
        timeZone,
      },
      metadata: { sobBookingId: intent.booking_id, sobBookingReference: intent.booking_reference },
      attendeeAddress: input.location.mode === "mobile" ? location : undefined,
    });
  } catch (error) {
    const safe = workflowError(error);
    await Promise.all([
      admin.from("bookings").update({ provider_sync_state: "failed", provider_error_code: safe.code, last_modified_at: new Date().toISOString() }).eq("id", intent.booking_id),
      recordAudit(intent.booking_id, "provider_sync_failed", "system", { operation: "create", code: safe.code }),
    ]);
    throw safe;
  }

  const localStatus: BookingStatus = providerBooking.status === "accepted" ? "confirmed" : "pending";
  const { error: updateError } = await admin.from("bookings").update({
    provider_booking_uid: providerBooking.uid,
    provider_event_type_id: providerBooking.eventTypeId || service.providerEventTypeId,
    provider_sync_state: "synced",
    provider_error_code: null,
    provider_event_updated_at: new Date().toISOString(),
    status: localStatus,
    appointment_start: providerBooking.start,
    appointment_end: providerBooking.end || null,
    original_appointment_start: providerBooking.start,
    original_appointment_end: providerBooking.end || null,
    last_modified_at: new Date().toISOString(),
  }).eq("id", intent.booking_id);
  if (updateError) {
    throw new BookingWorkflowError(`Your appointment was created but ${intent.booking_reference} needs calendar reconciliation. Please contact SOB Autofix.`, "persistence");
  }

  await recordAudit(intent.booking_id, localStatus === "confirmed" ? "confirmed" : "provider_synced", "provider", {
    appointmentStart: providerBooking.start,
  });
  const confirmed = await getBookingById(intent.booking_id);
  if (!confirmed) throw new BookingWorkflowError(`Your appointment was created under ${intent.booking_reference}, but confirmation is delayed.`, "persistence");
  if (localStatus === "confirmed") {
    const notification = notificationDetails(confirmed);
    if (notification) await sendBookingNotification(notification, "confirmed");
  }
  return toConfirmation(confirmed);
}

export async function beginBookingReschedule(bookingId: string) {
  const row = await getBookingById(bookingId);
  if (!row || !modifiableStatuses.includes(row.status) || row.provider !== "calcom" || !row.provider_booking_uid || !row.provider_event_type_id) return false;
  await recordAudit(bookingId, "reschedule_started", "customer");
  return true;
}

export async function getBookingRescheduleSlots(bookingId: string, start: string, end: string) {
  const row = await getBookingById(bookingId);
  if (!row || !modifiableStatuses.includes(row.status) || row.provider !== "calcom" || !row.provider_booking_uid || !row.provider_event_type_id) return null;
  const slots = await getAvailableRescheduleSlots({
    providerEventTypeId: row.provider_event_type_id,
    providerBookingUid: row.provider_booking_uid,
    start,
    end,
  });
  return { slots, timeZone: bookingTimezone() };
}

export async function rescheduleBooking(bookingId: string, appointmentStart: string, actor: "customer" | "admin" = "customer") {
  const row = await getBookingById(bookingId);
  if (!row || !modifiableStatuses.includes(row.status) || row.provider !== "calcom" || !row.provider_booking_uid || !row.provider_event_type_id) {
    return { outcome: "ineligible" as const, booking: row ? toPublicBooking(row) : undefined };
  }
  const provider = getSchedulingProvider();
  const timeZone = bookingTimezone();
  const selectedDate = calendarDateInTimeZone(appointmentStart, timeZone);
  if (!selectedDate) throw new BookingWorkflowError("Choose a valid appointment date and time.", "slot_unavailable");
  const currentSlots = await provider.getAvailableSlots({
    eventTypeId: row.provider_event_type_id,
    bookingUidToReschedule: row.provider_booking_uid,
    start: selectedDate,
    end: addCalendarDays(selectedDate, 1),
    timeZone,
  });
  const selectedTime = new Date(appointmentStart).getTime();
  if (!currentSlots.some((slot) => slotBelongsToCalendarDate(slot.start, selectedDate, timeZone) && new Date(slot.start).getTime() === selectedTime)) {
    throw new SchedulingProviderError("That appointment time is no longer available", "slot_unavailable", 409);
  }
  const updatedProviderBooking = await provider.rescheduleBooking(row.provider_booking_uid, appointmentStart, `${actor === "admin" ? "Staff" : "Customer"} requested reschedule through SOB Autofix`);
  const admin = createAdminClient();
  if (!admin) throw new Error("Booking persistence is not configured");
  const { error } = await admin.from("bookings").update({
    provider_booking_uid: updatedProviderBooking.uid,
    status: "rescheduled",
    appointment_start: updatedProviderBooking.start,
    appointment_end: updatedProviderBooking.end || null,
    provider_sync_state: "synced",
    provider_error_code: null,
    provider_event_updated_at: new Date().toISOString(),
    last_modified_at: new Date().toISOString(),
  }).eq("id", bookingId).in("status", modifiableStatuses);
  if (error) throw new Error("The rescheduled appointment needs reconciliation");
  await recordAudit(bookingId, "rescheduled", actor, {
    previousAppointmentStart: row.appointment_start,
    previousAppointmentEnd: row.appointment_end,
    appointmentStart: updatedProviderBooking.start,
    appointmentEnd: updatedProviderBooking.end,
    providerResult: "synced",
  });
  const updated = await getBookingById(bookingId);
  if (updated) {
    const notification = notificationDetails(updated);
    if (notification) await sendBookingNotification(notification, "rescheduled");
  }
  return { outcome: "rescheduled" as const, booking: updated ? toPublicBooking(updated) : undefined };
}

export async function cancelBooking(bookingId: string, actor: "customer" | "admin" = "customer") {
  const row = await getBookingById(bookingId);
  if (!row) return { outcome: "not_found" as const };
  if (!modifiableStatuses.includes(row.status) || row.provider !== "calcom" || !row.provider_booking_uid) {
    return { outcome: "ineligible" as const, booking: toPublicBooking(row) };
  }
  const reason = `${actor === "admin" ? "Staff" : "Customer"} requested cancellation through SOB Autofix`;
  await getSchedulingProvider().cancelBooking(row.provider_booking_uid, reason);
  const admin = createAdminClient();
  if (!admin) throw new Error("Booking persistence is not configured");
  const cancelledAt = new Date().toISOString();
  const { error } = await admin.from("bookings").update({
    status: "cancelled",
    cancellation_reason: reason,
    cancelled_at: cancelledAt,
    provider_sync_state: "synced",
    provider_error_code: null,
    provider_event_updated_at: cancelledAt,
    last_modified_at: cancelledAt,
  }).eq("id", bookingId).in("status", modifiableStatuses);
  if (error) throw new Error("The cancellation needs reconciliation");
  await recordAudit(bookingId, "cancelled", actor, { previousStatus: row.status, cancelledAt, reason, providerResult: "synced" });
  const updated = await getBookingById(bookingId);
  if (updated) {
    const notification = notificationDetails(updated);
    if (notification) await sendBookingNotification(notification, "cancelled");
  }
  return { outcome: "cancelled" as const, booking: updated ? toPublicBooking(updated) : undefined };
}

function webhookMetadata(event: CalComWebhook) {
  return event.payload.metadata && typeof event.payload.metadata === "object" ? event.payload.metadata : {};
}

async function findWebhookBooking(event: CalComWebhook) {
  const admin = createAdminClient();
  if (!admin) return null;
  const providerUids = [event.payload.uid, event.payload.rescheduleUid].filter((value): value is string => Boolean(value));
  for (const uid of providerUids) {
    const { data } = await admin.from("bookings").select(bookingSelect).eq("provider", "calcom").eq("provider_booking_uid", uid).maybeSingle();
    if (data) return data as unknown as BookingRow;
  }
  const metadata = webhookMetadata(event);
  const bookingId = typeof metadata.sobBookingId === "string" ? metadata.sobBookingId : null;
  const reference = typeof metadata.sobBookingReference === "string" ? metadata.sobBookingReference : null;
  if (bookingId) {
    const { data } = await admin.from("bookings").select(bookingSelect).eq("id", bookingId).maybeSingle();
    if (data) return data as unknown as BookingRow;
  }
  if (reference) {
    const { data } = await admin.from("bookings").select(bookingSelect).eq("booking_reference", reference).maybeSingle();
    if (data) return data as unknown as BookingRow;
  }
  return null;
}

export async function processCalComWebhook(event: CalComWebhook, rawBody: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Booking persistence is not configured");
  const eventKey = createHash("sha256").update(rawBody).digest("hex");
  const occurredAt = Number.isNaN(new Date(event.createdAt).getTime()) ? new Date().toISOString() : new Date(event.createdAt).toISOString();
  const { error: reservationError } = await admin.from("provider_webhook_events").insert({
    event_key: eventKey,
    provider: "calcom",
    event_type: event.triggerEvent,
    provider_booking_uid: event.payload.uid,
    occurred_at: occurredAt,
    outcome: "processing",
  });
  if (reservationError?.code === "23505") return { duplicate: true, outcome: "duplicate" as const };
  if (reservationError) throw new Error("Webhook could not be reserved");

  try {
    const row = await findWebhookBooking(event);
    if (!row) {
      await admin.from("provider_webhook_events").update({ outcome: "unknown_booking" }).eq("event_key", eventKey);
      return { duplicate: false, outcome: "unknown_booking" as const };
    }
    if (row.provider_event_updated_at && new Date(occurredAt) < new Date(row.provider_event_updated_at)) {
      await admin.from("provider_webhook_events").update({ outcome: "ignored_out_of_order" }).eq("event_key", eventKey);
      return { duplicate: false, outcome: "ignored_out_of_order" as const };
    }
    if (row.status === "cancelled" && event.triggerEvent !== "BOOKING_CANCELLED") {
      await admin.from("provider_webhook_events").update({ outcome: "ignored_terminal_state" }).eq("event_key", eventKey);
      return { duplicate: false, outcome: "ignored_terminal_state" as const };
    }

    const update: Record<string, unknown> = {
      provider_booking_uid: event.payload.uid,
      provider_event_type_id: event.payload.eventTypeId || row.provider_event_type_id,
      provider_sync_state: "synced",
      provider_error_code: null,
      provider_event_updated_at: occurredAt,
      last_modified_at: occurredAt,
    };
    let action: "confirmed" | "rescheduled" | "cancelled";
    let notificationType: "confirmed" | "rescheduled" | "cancelled";
    if (event.triggerEvent === "BOOKING_CANCELLED") {
      action = "cancelled";
      notificationType = "cancelled";
      update.status = "cancelled";
      update.cancellation_reason = event.payload.cancellationReason || null;
      update.cancelled_at = occurredAt;
    } else if (event.triggerEvent === "BOOKING_RESCHEDULED") {
      const start = event.payload.rescheduleStartTime || event.payload.startTime;
      const end = event.payload.rescheduleEndTime || event.payload.endTime;
      action = "rescheduled";
      notificationType = "rescheduled";
      update.status = "rescheduled";
      if (start) update.appointment_start = start;
      if (end) update.appointment_end = end;
    } else {
      action = "confirmed";
      notificationType = "confirmed";
      update.status = event.payload.status?.toLowerCase() === "pending" ? "pending" : "confirmed";
      if (event.payload.startTime) {
        update.appointment_start = event.payload.startTime;
        if (!row.provider_booking_uid) update.original_appointment_start = event.payload.startTime;
      }
      if (event.payload.endTime) {
        update.appointment_end = event.payload.endTime;
        if (!row.provider_booking_uid) update.original_appointment_end = event.payload.endTime;
      }
    }

    const { error } = await admin.from("bookings").update(update).eq("id", row.id);
    if (error) throw new Error("Webhook booking update failed");
    await recordAudit(row.id, action, "provider", {
      previousAppointmentStart: action === "rescheduled" ? row.appointment_start : undefined,
      previousAppointmentEnd: action === "rescheduled" ? row.appointment_end : undefined,
      appointmentStart: update.appointment_start,
      appointmentEnd: update.appointment_end,
      providerEvent: event.triggerEvent,
    });
    await admin.from("provider_webhook_events").update({ outcome: "processed" }).eq("event_key", eventKey);
    const updated = await getBookingById(row.id);
    if (updated && !(notificationType === "confirmed" && updated.status !== "confirmed")) {
      const notification = notificationDetails(updated);
      if (notification) await sendBookingNotification(notification, notificationType);
    }
    return { duplicate: false, outcome: "processed" as const };
  } catch (error) {
    await admin.from("provider_webhook_events").delete().eq("event_key", eventKey);
    throw error;
  }
}
