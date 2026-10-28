import "server-only";

import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { isMissingSchemaError, SCHEMA_MISSING_MESSAGE } from "@/lib/exchange/schema";
import { getSiteSettings } from "@/lib/settings/repository";
import { type DiaryConflict } from "./conflicts";
import { outsideHours, parseWeeklyHours } from "./hours";
import { canSeeNotes } from "./mapping";
import { latestViewingEmails, sendViewingEmail, type EmailOutcome } from "./notifications";
import { canUseLink, findConflicts, getAppointment, getBookingForDiary, loadStaffDirectory, staffNameMap, type AppointmentDetail } from "./repository";
import { appointmentTimes, type AppointmentFormInput } from "./schema";
import { londonToUtc } from "./time";
import { canChangeStatus, isAppointmentKind, isAppointmentStatus, type AppointmentStatus } from "./types";
import { overrideAccepted, warningSignature, type OverrideInput } from "./warnings";

export type OutsideHoursWarning = { open: string; close: string };

export type ServiceResult =
  | { ok: true; id: string; message: string; email?: EmailOutcome }
  | { ok: false; kind: "conflict"; conflicts: DiaryConflict[]; outsideHours: OutsideHoursWarning | null; signature: string; message: string; fieldErrors?: Record<string, string> }
  | { ok: false; kind: "invalid"; fieldErrors: Record<string, string>; message: string }
  | { ok: false; kind: "stale"; message: string }
  | { ok: false; kind: "error"; message: string };

const AUDIT_FAILED = "The change was saved, but its audit entry could not be recorded. Tell the owner.";
export const STALE_MESSAGE = "Someone else changed this appointment while you were editing. Your changes are still in the form: reload the page to see the latest version, then make your changes again.";

async function audit(staff: StaffContext, action: string, entityType: string, id: string, detail: Record<string, unknown>) {
  try {
    await auditStaffAction(staff, action, entityType, id, detail);
    return true;
  } catch {
    return false;
  }
}

type Candidate = Parameters<typeof findConflicts>[1];

/**
 * Rechecks clashes (and configured opening hours) at the moment of saving.
 * Returns null when there is nothing to warn about, or when the person has
 * acknowledged exactly these warnings and given a reason; otherwise the
 * warnings to show. Returns `override` when a reason must be stored.
 */
async function evaluateWarnings(staff: StaffContext, candidate: Candidate, override: OverrideInput | undefined, options: { ignoreEntryId?: string } = {}): Promise<{ block: ServiceResult | null; overridden: string | null }> {
  const [directory, site] = await Promise.all([loadStaffDirectory(staff.client), getSiteSettings()]);
  const conflicts = (await findConflicts(staff.client, candidate, staff.role, staffNameMap(directory))).filter((conflict) => conflict.entry.id !== options.ignoreEntryId);
  const hours = outsideHours(candidate.start, candidate.end, parseWeeklyHours(site.openingHours as Record<string, string>)) || null;
  if (!conflicts.length && !hours) return { block: null, overridden: null };
  const signature = warningSignature(conflicts, hours);
  const acknowledged = override?.acknowledged === signature;
  if (overrideAccepted(signature, override)) return { block: null, overridden: override?.reason?.trim() ?? null };
  const message = override?.acknowledged && !acknowledged
    ? "The diary changed since you last checked. Review the warnings again."
    : acknowledged
      ? "Give a short reason for going ahead despite the warning."
      : conflicts.length
        ? "This clashes with other entries in the diary. Change the time, or give a reason and save anyway."
        : "This is outside the opening hours set in Settings. Change the time, or give a reason and save anyway.";
  return {
    block: { ok: false, kind: "conflict", conflicts, outsideHours: hours, signature, message, fieldErrors: acknowledged ? { overrideReason: "Give a reason of at least 3 characters" } : undefined },
    overridden: null,
  };
}

/**
 * The one place a diary appointment row is updated, whether from the diary,
 * the Viewings subtab or a workflow page. Compare-and-set on updated_at stops
 * one person silently overwriting another's change. Works before migration
 * 20261028090300 by retrying without the override columns.
 */
async function writeAppointment(staff: StaffContext, id: string, patch: Record<string, unknown>, expectedUpdatedAt: string | null | undefined): Promise<"ok" | "stale" | "missing" | "error"> {
  const run = async (values: Record<string, unknown>) => {
    let query = staff.client.from("diary_appointments").update(values).eq("id", id).is("deleted_at", null);
    if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
    return query.select("id");
  };
  let result = await run(patch);
  if (result.error && isMissingSchemaError(result.error)) {
    const legacy = Object.fromEntries(Object.entries(patch).filter(([key]) => !key.startsWith("conflict_override_")));
    result = await run(legacy);
  }
  if (result.error) return isMissingSchemaError(result.error) ? "missing" : "error";
  return (result.data || []).length ? "ok" : "stale";
}

function writeFailure(outcome: "stale" | "missing" | "error", fallback: string): ServiceResult {
  if (outcome === "stale") return { ok: false, kind: "stale", message: STALE_MESSAGE };
  return { ok: false, kind: "error", message: outcome === "missing" ? SCHEMA_MISSING_MESSAGE : fallback };
}

function overrideColumns(staff: StaffContext, reason: string | null, clear: boolean) {
  if (reason) return { conflict_override_reason: reason, conflict_override_by: staff.userId, conflict_override_at: new Date().toISOString() };
  return clear ? { conflict_override_reason: null, conflict_override_by: null, conflict_override_at: null } : {};
}

/** Create or update a diary appointment from a validated form. */
export async function saveAppointment(staff: StaffContext, input: AppointmentFormInput): Promise<ServiceResult> {
  const timing = appointmentTimes(input.date, input.startTime, input.endTime);
  if (!timing.ok) return { ok: false, kind: "invalid", fieldErrors: { [timing.field]: timing.message }, message: timing.message };

  let existing: AppointmentDetail | null = null;
  if (input.id) {
    const loaded = await getAppointment(staff.client, input.id);
    if (loaded.schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
    existing = loaded.appointment;
    if (!existing) return { ok: false, kind: "error", message: "This appointment no longer exists. It may have been removed." };
    if (existing.status === "cancelled") return { ok: false, kind: "error", message: "This appointment is cancelled. Create a new appointment instead." };
    if (input.updatedAt && existing.updated_at !== input.updatedAt) return { ok: false, kind: "stale", message: STALE_MESSAGE };
  }
  const previousStatus: AppointmentStatus | null = existing ? (isAppointmentStatus(existing.status) ? existing.status : "confirmed") : null;
  if (!canChangeStatus(previousStatus, input.status)) {
    const message = previousStatus ? `A ${previousStatus.replace("_", " ")} appointment cannot become ${input.status.replace("_", " ")}.` : "New appointments start as requested or confirmed.";
    return { ok: false, kind: "invalid", fieldErrors: { status: message }, message };
  }

  // Links a role cannot change (for example customers for workshop staff) keep
  // their current value. On a new appointment, links prefilled from the page
  // that sent them here are kept.
  const keep = <T,>(allowed: boolean, next: T, current: T) => (allowed || !existing ? next : current);
  const record = {
    kind: input.kind,
    status: input.status,
    title: input.title,
    starts_at: timing.times.start,
    ends_at: timing.times.end,
    location: input.location ?? null,
    assigned_to: input.assignedTo,
    sale_vehicle_id: keep(canUseLink(staff.role, "vehicle"), input.vehicleId, existing?.sale_vehicle_id ?? null),
    customer_id: keep(canUseLink(staff.role, "customer"), input.customerId, existing?.customer_id ?? null),
    enquiry_id: keep(canUseLink(staff.role, "enquiry"), input.enquiryId, existing?.enquiry_id ?? null),
    seller_submission_id: keep(canUseLink(staff.role, "submission"), input.submissionId, existing?.seller_submission_id ?? null),
    vehicle_sale_id: keep(canUseLink(staff.role, "sale"), input.saleId, existing?.vehicle_sale_id ?? null),
    notes: keep(canSeeNotes(staff.role, input.kind) && (!existing || canSeeNotes(staff.role, isAppointmentKind(existing.kind) ? existing.kind : "other")), input.notes ?? null, existing?.notes ?? null),
  };

  const directory = await loadStaffDirectory(staff.client);
  if (record.assigned_to && !directory.some((member) => member.id === record.assigned_to)) {
    return { ok: false, kind: "invalid", fieldErrors: { assignedTo: "Choose a current staff member" }, message: "Choose a current staff member" };
  }

  const moved = existing ? Date.parse(existing.starts_at) !== Date.parse(record.starts_at) : true;
  const retimed = existing ? moved || Date.parse(existing.ends_at) !== Date.parse(record.ends_at) : true;
  const placementChanged = !existing || retimed || existing.assigned_to !== record.assigned_to || existing.sale_vehicle_id !== record.sale_vehicle_id || existing.kind !== record.kind;
  // Finished appointments are history: no warnings about the past.
  const active = record.status === "requested" || record.status === "confirmed";
  let overridden: string | null = null;
  if (active && placementChanged) {
    const warnings = await evaluateWarnings(staff, { id: input.id, kind: record.kind, start: record.starts_at, end: record.ends_at, assignedTo: record.assigned_to, saleVehicleId: record.sale_vehicle_id }, { acknowledged: input.acknowledgedConflicts, reason: input.overrideReason });
    if (warnings.block) return warnings.block;
    overridden = warnings.overridden;
  }

  if (!existing) {
    const insert = async (values: Record<string, unknown>) => staff.client.from("diary_appointments").insert(values).select("id").single();
    const base = { ...record, created_by: staff.userId, confirmed_at: record.status === "confirmed" ? new Date().toISOString() : null };
    let created = await insert({ ...base, ...overrideColumns(staff, overridden, false) });
    if (created.error && isMissingSchemaError(created.error) && overridden) created = await insert(base);
    if (created.error || !created.data) return { ok: false, kind: "error", message: isMissingSchemaError(created.error) ? SCHEMA_MISSING_MESSAGE : "The appointment could not be saved. Try again." };
    const id = (created.data as { id: string }).id;
    const audited = await audit(staff, "diary.appointment_created", "diary_appointment", id, { kind: record.kind, status: record.status, startsAt: record.starts_at, endsAt: record.ends_at, assignedTo: record.assigned_to, conflictOverride: overridden });
    return { ok: true, id, message: audited ? "Appointment saved." : AUDIT_FAILED };
  }

  const confirmedNow = record.status === "confirmed" && existing.status !== "confirmed";
  const outcome = await writeAppointment(staff, existing.id, { ...record, ...(confirmedNow ? { confirmed_at: new Date().toISOString() } : {}), ...overrideColumns(staff, overridden, placementChanged) }, existing.updated_at);
  if (outcome !== "ok") return writeFailure(outcome, "The appointment could not be saved. Try again.");

  const changed = Object.entries(record).filter(([key, value]) => {
    const before = (existing as Record<string, unknown>)[key] ?? null;
    if (key === "starts_at" || key === "ends_at") return Date.parse(String(before)) !== Date.parse(String(value));
    return before !== (value ?? null);
  }).map(([key]) => key);
  const action = retimed ? "diary.appointment_rescheduled" : existing.status !== record.status ? "diary.appointment_status_changed" : record.assigned_to !== existing.assigned_to ? "diary.appointment_assigned" : "diary.appointment_updated";
  const audited = await audit(staff, action, "diary_appointment", existing.id, {
    changed,
    previousStartsAt: moved ? existing.starts_at : undefined,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    status: record.status,
    previousStatus: existing.status !== record.status ? existing.status : undefined,
    assignedTo: record.assigned_to,
    conflictOverride: overridden,
  });

  if (confirmedNow && record.kind === "viewing" && record.enquiry_id) await markViewingBooked(staff, record.enquiry_id);

  let email: EmailOutcome | undefined;
  if (input.notifyCustomer && record.kind === "viewing" && (moved || confirmedNow) && active) {
    const template = confirmedNow ? "confirmed" : record.status === "requested" ? "proposed" : "rescheduled";
    email = await sendViewingEmail(staff, existing.id, template, { previousStart: moved ? existing.starts_at : null });
  }
  return { ok: true, id: existing.id, message: audited ? "Appointment saved." : AUDIT_FAILED, email };
}

export async function cancelAppointment(staff: StaffContext, input: { id: string; reason: string; notifyCustomer: boolean; updatedAt?: string | null }): Promise<ServiceResult> {
  const { appointment, schemaMissing } = await getAppointment(staff.client, input.id);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!appointment) return { ok: false, kind: "error", message: "This appointment no longer exists." };
  if (appointment.status === "cancelled") return { ok: true, id: appointment.id, message: "This appointment was already cancelled." };
  if (!canChangeStatus(isAppointmentStatus(appointment.status) ? appointment.status : "confirmed", "cancelled")) return { ok: false, kind: "error", message: "A completed or no-show appointment cannot be cancelled." };
  if (input.updatedAt && input.updatedAt !== appointment.updated_at) return { ok: false, kind: "stale", message: STALE_MESSAGE };
  const outcome = await writeAppointment(staff, appointment.id, { status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: input.reason }, appointment.updated_at);
  if (outcome !== "ok") return writeFailure(outcome, "The appointment could not be cancelled. Try again.");
  const audited = await audit(staff, appointment.status === "requested" ? "diary.viewing_declined" : "diary.appointment_cancelled", "diary_appointment", appointment.id, { kind: appointment.kind, previousStatus: appointment.status, startsAt: appointment.starts_at });
  let email: EmailOutcome | undefined;
  if (input.notifyCustomer && appointment.kind === "viewing") email = await sendViewingEmail(staff, appointment.id, "cancelled", { message: input.reason });
  return { ok: true, id: appointment.id, message: audited ? "Appointment cancelled." : AUDIT_FAILED, email };
}

export async function assignBookingStaff(staff: StaffContext, input: { bookingId: string; assignedTo: string | null; acknowledgedConflicts?: string; overrideReason?: string | null }): Promise<ServiceResult> {
  const { booking, schemaMissing } = await getBookingForDiary(staff.client, input.bookingId);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!booking) return { ok: false, kind: "error", message: "This booking could not be found." };
  if ((booking.assigned_to ?? null) === input.assignedTo) return { ok: true, id: booking.id, message: "No change to save." };
  const directory = await loadStaffDirectory(staff.client);
  if (input.assignedTo && !directory.some((member) => member.id === input.assignedTo)) return { ok: false, kind: "invalid", fieldErrors: { assignedTo: "Choose a current staff member" }, message: "Choose a current staff member" };
  let overridden: string | null = null;
  if (input.assignedTo && booking.status !== "cancelled" && booking.status !== "completed") {
    const end = booking.appointment_end && Date.parse(booking.appointment_end) > Date.parse(booking.appointment_start) ? booking.appointment_end : new Date(Date.parse(booking.appointment_start) + 3_600_000).toISOString();
    // Only staff clashes matter here: the booking's own time is set by online booking.
    const warnings = await evaluateStaffClash(staff, booking.id, booking.appointment_start, end, input.assignedTo, { acknowledged: input.acknowledgedConflicts, reason: input.overrideReason });
    if (warnings.block) return warnings.block;
    overridden = warnings.overridden;
  }
  // Compare-and-set on the current assignment so two people assigning at once cannot both win.
  let query = staff.client.from("bookings").update({ assigned_to: input.assignedTo }).eq("id", booking.id);
  query = booking.assigned_to ? query.eq("assigned_to", booking.assigned_to) : query.is("assigned_to", null);
  const { data, error } = await query.select("id");
  if (error) return { ok: false, kind: "error", message: isMissingSchemaError(error) ? SCHEMA_MISSING_MESSAGE : "The booking could not be updated. Try again." };
  if (!(data || []).length) return { ok: false, kind: "stale", message: "Someone else changed who is assigned to this booking. Reload the page to see the latest version." };
  const audited = await audit(staff, "diary.booking_assigned", "booking", booking.id, { assignedTo: input.assignedTo, previousAssignedTo: booking.assigned_to ?? null, conflictOverride: overridden });
  return { ok: true, id: booking.id, message: audited ? (input.assignedTo ? "Staff member assigned." : "Booking unassigned.") : AUDIT_FAILED };
}

async function evaluateStaffClash(staff: StaffContext, bookingId: string, start: string, end: string, assignedTo: string, override: OverrideInput) {
  const directory = await loadStaffDirectory(staff.client);
  const conflicts = (await findConflicts(staff.client, { kind: "workshop_booking", start, end, assignedTo }, staff.role, staffNameMap(directory))).filter((conflict) => conflict.entry.id !== bookingId);
  if (!conflicts.length) return { block: null, overridden: null };
  const signature = warningSignature(conflicts, null);
  const acknowledged = override.acknowledged === signature;
  if (overrideAccepted(signature, override)) return { block: null, overridden: override.reason?.trim() ?? null };
  const block: ServiceResult = { ok: false, kind: "conflict", conflicts, outsideHours: null, signature, message: acknowledged ? "Give a short reason for assigning anyway." : "This person is already booked at this time.", fieldErrors: acknowledged ? { overrideReason: "Give a reason of at least 3 characters" } : undefined };
  return { block, overridden: null };
}

async function markViewingBooked(staff: StaffContext, enquiryId: string) {
  const { data } = await staff.client.from("enquiries").select("id,sales_stage,status").eq("id", enquiryId).maybeSingle();
  const enquiry = data as { id: string; sales_stage: string | null; status: string } | null;
  if (!enquiry) return;
  // Only move forwards: never back from negotiating, reserved or sold.
  if (enquiry.sales_stage && ["negotiating", "reserved", "sold"].includes(enquiry.sales_stage)) return;
  if (enquiry.sales_stage === "viewing_booked") return;
  await staff.client.from("enquiries").update({ sales_stage: "viewing_booked" }).eq("id", enquiry.id);
  await audit(staff, "sales.stage_changed", "enquiry", enquiry.id, { from: enquiry.sales_stage, to: "viewing_booked", via: "diary" });
}

export type ViewingActionInput = { id: string; updatedAt?: string | null } & OverrideInput;

/** requested -> confirmed, rechecking clashes at the moment of confirming. */
export async function confirmViewing(staff: StaffContext, input: ViewingActionInput): Promise<ServiceResult> {
  const { appointment, schemaMissing } = await getAppointment(staff.client, input.id);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!appointment || appointment.kind !== "viewing") return { ok: false, kind: "error", message: "This viewing could not be found." };
  if (appointment.status === "confirmed") return { ok: true, id: appointment.id, message: "This viewing was already confirmed." };
  if (appointment.status !== "requested") return { ok: false, kind: "error", message: `This viewing is ${appointment.status.replace("_", " ")} and cannot be confirmed.` };
  if (input.updatedAt && input.updatedAt !== appointment.updated_at) return { ok: false, kind: "stale", message: STALE_MESSAGE };
  const warnings = await evaluateWarnings(staff, { id: appointment.id, kind: "viewing", start: appointment.starts_at, end: appointment.ends_at, assignedTo: appointment.assigned_to, saleVehicleId: appointment.sale_vehicle_id }, input);
  if (warnings.block) return warnings.block;
  const outcome = await writeAppointment(staff, appointment.id, { status: "confirmed", confirmed_at: new Date().toISOString(), ...overrideColumns(staff, warnings.overridden, false) }, appointment.updated_at);
  if (outcome !== "ok") return writeFailure(outcome, "The viewing could not be confirmed. Try again.");
  await audit(staff, "diary.viewing_confirmed", "diary_appointment", appointment.id, { startsAt: appointment.starts_at, conflictOverride: warnings.overridden });
  if (appointment.enquiry_id) await markViewingBooked(staff, appointment.enquiry_id);
  const email = await sendViewingEmail(staff, appointment.id, "confirmed");
  return { ok: true, id: appointment.id, message: "Viewing confirmed.", email };
}

/** Moves a requested viewing to a new suggested time; it stays requested until confirmed. */
export async function proposeViewingTime(staff: StaffContext, input: ViewingActionInput & { date: string; startTime: string; message?: string | null }): Promise<ServiceResult> {
  const { appointment, schemaMissing } = await getAppointment(staff.client, input.id);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!appointment || appointment.kind !== "viewing") return { ok: false, kind: "error", message: "This viewing could not be found." };
  if (appointment.status !== "requested") return { ok: false, kind: "error", message: "Only a requested viewing can be given a suggested time. Edit a confirmed viewing in the diary to reschedule it." };
  if (input.updatedAt && input.updatedAt !== appointment.updated_at) return { ok: false, kind: "stale", message: STALE_MESSAGE };
  const start = londonToUtc(input.date, input.startTime);
  if (!start) return { ok: false, kind: "invalid", fieldErrors: { startTime: "That time does not exist on this date because the clocks go forward." }, message: "Choose another time." };
  if (start.getTime() < Date.now()) return { ok: false, kind: "invalid", fieldErrors: { date: "Choose a time in the future" }, message: "Choose a time in the future." };
  // Keep the appointment's own length (the configured viewing length when it was requested).
  const length = Math.max(15 * 60_000, Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at));
  const end = new Date(start.getTime() + length);
  const warnings = await evaluateWarnings(staff, { id: appointment.id, kind: "viewing", start: start.toISOString(), end: end.toISOString(), assignedTo: appointment.assigned_to, saleVehicleId: appointment.sale_vehicle_id }, input);
  if (warnings.block) return warnings.block;
  const outcome = await writeAppointment(staff, appointment.id, { starts_at: start.toISOString(), ends_at: end.toISOString(), ...overrideColumns(staff, warnings.overridden, true) }, appointment.updated_at);
  if (outcome !== "ok") return writeFailure(outcome, "The new time could not be saved. Try again.");
  await audit(staff, "diary.viewing_proposed", "diary_appointment", appointment.id, { previousStartsAt: appointment.starts_at, startsAt: start.toISOString(), conflictOverride: warnings.overridden });
  const email = await sendViewingEmail(staff, appointment.id, "proposed", { previousStart: appointment.starts_at, message: input.message });
  return { ok: true, id: appointment.id, message: "New time suggested. Confirm the viewing once the customer agrees.", email };
}

export async function declineViewing(staff: StaffContext, input: { id: string; reason: string; updatedAt?: string | null }) {
  return cancelAppointment(staff, { id: input.id, reason: input.reason, notifyCustomer: true, updatedAt: input.updatedAt });
}

/** Resends the most recent customer email for an appointment, exactly as it was first attempted. */
export async function retryViewingEmail(staff: StaffContext, id: string): Promise<EmailOutcome> {
  const latest = (await latestViewingEmails(staff.client, [id])).get(id);
  if (!latest) return { status: "skipped", message: "There is no email to retry for this appointment." };
  if (latest.status === "sent") return { status: "sent", message: "This email has already been sent." };
  return sendViewingEmail(staff, id, latest.template, { previousStart: latest.previousStart, message: latest.message });
}
