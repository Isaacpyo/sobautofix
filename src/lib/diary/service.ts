import "server-only";

import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { isMissingSchemaError, SCHEMA_MISSING_MESSAGE } from "@/lib/exchange/schema";
import { conflictSignature, type DiaryConflict } from "./conflicts";
import { canSeeNotes } from "./mapping";
import { latestViewingEmails, sendViewingEmail, type EmailOutcome } from "./notifications";
import { canUseLink, findConflicts, getAppointment, getBookingForDiary, loadStaffDirectory, staffNameMap, type AppointmentDetail } from "./repository";
import { appointmentTimes, type AppointmentFormInput } from "./schema";
import { londonToUtc } from "./time";
import { isAppointmentKind } from "./types";

export type ServiceResult =
  | { ok: true; id: string; message: string; email?: EmailOutcome }
  | { ok: false; kind: "conflict"; conflicts: DiaryConflict[]; signature: string; message: string }
  | { ok: false; kind: "invalid"; fieldErrors: Record<string, string>; message: string }
  | { ok: false; kind: "error"; message: string };

const AUDIT_FAILED = "The change was saved, but its audit entry could not be recorded. Tell the owner.";

async function audit(staff: StaffContext, action: string, entityType: string, id: string, detail: Record<string, unknown>) {
  try {
    await auditStaffAction(staff, action, entityType, id, detail);
    return true;
  } catch {
    return false;
  }
}

async function checkConflicts(staff: StaffContext, candidate: Parameters<typeof findConflicts>[1], acknowledged: string | undefined): Promise<ServiceResult | null> {
  const directory = await loadStaffDirectory(staff.client);
  const conflicts = await findConflicts(staff.client, candidate, staff.role, staffNameMap(directory));
  if (!conflicts.length) return null;
  const signature = conflictSignature(conflicts);
  if (acknowledged && acknowledged === signature) return null;
  return {
    ok: false,
    kind: "conflict",
    conflicts,
    signature,
    message: acknowledged ? "The diary changed since you last checked. Review the clashes again before saving." : "This clashes with other entries in the diary. Check them, then save anyway or change the time.",
  };
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

  const clash = await checkConflicts(staff, { id: input.id, kind: record.kind, start: record.starts_at, end: record.ends_at, assignedTo: record.assigned_to, saleVehicleId: record.sale_vehicle_id }, input.acknowledgedConflicts);
  if (clash) return clash;

  if (!existing) {
    const { data, error } = await staff.client
      .from("diary_appointments")
      .insert({ ...record, created_by: staff.userId, confirmed_at: record.status === "confirmed" ? new Date().toISOString() : null })
      .select("id")
      .single();
    if (error || !data) return { ok: false, kind: "error", message: isMissingSchemaError(error) ? SCHEMA_MISSING_MESSAGE : "The appointment could not be saved. Try again." };
    const audited = await audit(staff, "diary.appointment_created", "diary_appointment", data.id, { kind: record.kind, status: record.status, startsAt: record.starts_at, endsAt: record.ends_at, assignedTo: record.assigned_to, conflictsAcknowledged: Boolean(input.acknowledgedConflicts) });
    return { ok: true, id: data.id, message: audited ? "Appointment saved." : AUDIT_FAILED };
  }

  const moved = Date.parse(existing.starts_at) !== Date.parse(record.starts_at);
  const retimed = moved || Date.parse(existing.ends_at) !== Date.parse(record.ends_at);
  const confirmedNow = record.status === "confirmed" && existing.status !== "confirmed";
  const { error } = await staff.client
    .from("diary_appointments")
    .update({ ...record, confirmed_at: confirmedNow ? new Date().toISOString() : undefined })
    .eq("id", existing.id)
    .is("deleted_at", null);
  if (error) return { ok: false, kind: "error", message: isMissingSchemaError(error) ? SCHEMA_MISSING_MESSAGE : "The appointment could not be saved. Try again." };

  const changed = Object.entries(record).filter(([key, value]) => {
    const before = (existing as Record<string, unknown>)[key] ?? null;
    if (key === "starts_at" || key === "ends_at") return Date.parse(String(before)) !== Date.parse(String(value));
    return before !== (value ?? null);
  }).map(([key]) => key);
  const action = retimed ? "diary.appointment_rescheduled" : record.assigned_to !== existing.assigned_to ? "diary.appointment_assigned" : "diary.appointment_updated";
  const audited = await audit(staff, action, "diary_appointment", existing.id, {
    changed,
    previousStartsAt: moved ? existing.starts_at : undefined,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    status: record.status,
    previousStatus: existing.status !== record.status ? existing.status : undefined,
    assignedTo: record.assigned_to,
    conflictsAcknowledged: Boolean(input.acknowledgedConflicts),
  });

  if (confirmedNow && record.kind === "viewing" && record.enquiry_id) await markViewingBooked(staff, record.enquiry_id);

  let email: EmailOutcome | undefined;
  if (input.notifyCustomer && record.kind === "viewing" && (moved || confirmedNow) && record.status !== "completed" && record.status !== "no_show") {
    const template = confirmedNow ? "confirmed" : record.status === "requested" ? "proposed" : "rescheduled";
    email = await sendViewingEmail(staff, existing.id, template, { previousStart: moved ? existing.starts_at : null });
  }
  return { ok: true, id: existing.id, message: audited ? "Appointment saved." : AUDIT_FAILED, email };
}

export async function cancelAppointment(staff: StaffContext, input: { id: string; reason: string; notifyCustomer: boolean }): Promise<ServiceResult> {
  const { appointment, schemaMissing } = await getAppointment(staff.client, input.id);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!appointment) return { ok: false, kind: "error", message: "This appointment no longer exists." };
  if (appointment.status === "cancelled") return { ok: true, id: appointment.id, message: "This appointment was already cancelled." };
  const { error } = await staff.client
    .from("diary_appointments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: input.reason })
    .eq("id", appointment.id);
  if (error) return { ok: false, kind: "error", message: "The appointment could not be cancelled. Try again." };
  const audited = await audit(staff, "diary.appointment_cancelled", "diary_appointment", appointment.id, { kind: appointment.kind, previousStatus: appointment.status, startsAt: appointment.starts_at });
  let email: EmailOutcome | undefined;
  if (input.notifyCustomer && appointment.kind === "viewing") email = await sendViewingEmail(staff, appointment.id, "cancelled", { message: input.reason });
  return { ok: true, id: appointment.id, message: audited ? "Appointment cancelled." : AUDIT_FAILED, email };
}

export async function assignBookingStaff(staff: StaffContext, input: { bookingId: string; assignedTo: string | null; acknowledgedConflicts?: string }): Promise<ServiceResult> {
  const { booking, schemaMissing } = await getBookingForDiary(staff.client, input.bookingId);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!booking) return { ok: false, kind: "error", message: "This booking could not be found." };
  if ((booking.assigned_to ?? null) === input.assignedTo) return { ok: true, id: booking.id, message: "No change to save." };
  const directory = await loadStaffDirectory(staff.client);
  if (input.assignedTo && !directory.some((member) => member.id === input.assignedTo)) return { ok: false, kind: "invalid", fieldErrors: { assignedTo: "Choose a current staff member" }, message: "Choose a current staff member" };
  if (input.assignedTo) {
    const end = booking.appointment_end && Date.parse(booking.appointment_end) > Date.parse(booking.appointment_start) ? booking.appointment_end : new Date(Date.parse(booking.appointment_start) + 3_600_000).toISOString();
    const clash = await checkConflicts(staff, { id: null, kind: "workshop_booking", start: booking.appointment_start, end, assignedTo: input.assignedTo }, input.acknowledgedConflicts);
    if (clash && clash.ok === false && clash.kind === "conflict") {
      // A booking never clashes with itself.
      const conflicts = clash.conflicts.filter((conflict) => conflict.entry.id !== booking.id);
      if (conflicts.length && conflictSignature(conflicts) !== input.acknowledgedConflicts) return { ...clash, conflicts, signature: conflictSignature(conflicts) };
    }
  }
  const { error } = await staff.client.from("bookings").update({ assigned_to: input.assignedTo }).eq("id", booking.id);
  if (error) return { ok: false, kind: "error", message: isMissingSchemaError(error) ? SCHEMA_MISSING_MESSAGE : "The booking could not be updated. Try again." };
  const audited = await audit(staff, "diary.booking_assigned", "booking", booking.id, { assignedTo: input.assignedTo, previousAssignedTo: booking.assigned_to ?? null });
  return { ok: true, id: booking.id, message: audited ? (input.assignedTo ? "Staff member assigned." : "Booking unassigned.") : AUDIT_FAILED };
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

export async function confirmViewing(staff: StaffContext, id: string): Promise<ServiceResult> {
  const { appointment, schemaMissing } = await getAppointment(staff.client, id);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!appointment || appointment.kind !== "viewing") return { ok: false, kind: "error", message: "This viewing could not be found." };
  if (appointment.status === "cancelled") return { ok: false, kind: "error", message: "This viewing was cancelled." };
  if (appointment.status !== "confirmed") {
    const { error } = await staff.client.from("diary_appointments").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, kind: "error", message: "The viewing could not be confirmed. Try again." };
    await audit(staff, "diary.viewing_confirmed", "diary_appointment", id, { startsAt: appointment.starts_at });
  }
  if (appointment.enquiry_id) await markViewingBooked(staff, appointment.enquiry_id);
  const email = await sendViewingEmail(staff, id, "confirmed");
  return { ok: true, id, message: "Viewing confirmed.", email };
}

export async function proposeViewingTime(staff: StaffContext, input: { id: string; date: string; startTime: string; message?: string | null }): Promise<ServiceResult> {
  const { appointment, schemaMissing } = await getAppointment(staff.client, input.id);
  if (schemaMissing) return { ok: false, kind: "error", message: SCHEMA_MISSING_MESSAGE };
  if (!appointment || appointment.kind !== "viewing") return { ok: false, kind: "error", message: "This viewing could not be found." };
  const start = londonToUtc(input.date, input.startTime);
  if (!start) return { ok: false, kind: "invalid", fieldErrors: { startTime: "That time does not exist on this date because the clocks go forward." }, message: "Choose another time." };
  if (start.getTime() < Date.now()) return { ok: false, kind: "invalid", fieldErrors: { date: "Choose a time in the future" }, message: "Choose a time in the future." };
  const length = Math.max(15 * 60_000, Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at));
  const end = new Date(start.getTime() + length);
  const { error } = await staff.client.from("diary_appointments").update({ starts_at: start.toISOString(), ends_at: end.toISOString(), status: "requested" }).eq("id", input.id);
  if (error) return { ok: false, kind: "error", message: "The new time could not be saved. Try again." };
  await audit(staff, "diary.viewing_proposed", "diary_appointment", input.id, { previousStartsAt: appointment.starts_at, startsAt: start.toISOString() });
  const email = await sendViewingEmail(staff, input.id, "proposed", { previousStart: appointment.starts_at, message: input.message });
  return { ok: true, id: input.id, message: "New time suggested. Confirm the viewing once the customer agrees.", email };
}

export async function declineViewing(staff: StaffContext, input: { id: string; reason: string }) {
  return cancelAppointment(staff, { id: input.id, reason: input.reason, notifyCustomer: true });
}

/** Resends the most recent customer email for an appointment, exactly as it was first attempted. */
export async function retryViewingEmail(staff: StaffContext, id: string): Promise<EmailOutcome> {
  const latest = (await latestViewingEmails(staff.client, [id])).get(id);
  if (!latest) return { status: "skipped", message: "There is no email to retry for this appointment." };
  if (latest.status === "sent") return { status: "sent", message: "This email has already been sent." };
  return sendViewingEmail(staff, id, latest.template, { previousStart: latest.previousStart, message: latest.message });
}
