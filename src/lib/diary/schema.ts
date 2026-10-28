// Validation for diary forms. Times arrive as London wall-clock date and time
// fields and are converted to UTC instants here, so a form can never store a
// time that does not exist (the hour skipped when the clocks go forward).

import { z } from "zod";
import { clockChangeNote, isDateKey, isTimeKey, londonToUtc } from "./time";
import { appointmentKinds, diaryTypeLabels, type AppointmentKind } from "./types";

const optionalUuid = z.preprocess((value) => (value === "" || value == null ? null : value), z.uuid().nullable());
const optionalText = (max: number) => z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().max(max, `Keep this under ${max} characters`).transform((value) => value || null).nullable().optional());

/** Statuses staff can choose in the form; cancelling has its own step with a reason. */
export const editableStatuses = ["requested", "confirmed", "completed", "no_show"] as const;

export const appointmentFormSchema = z.object({
  id: optionalUuid.optional(),
  kind: z.enum(appointmentKinds, { message: "Choose the type of appointment" }),
  status: z.enum(editableStatuses, { message: "Choose a status" }),
  title: z.string().trim().min(1, "Enter a title").max(160, "Keep the title under 160 characters"),
  date: z.string().refine(isDateKey, "Enter a valid date"),
  startTime: z.string().refine(isTimeKey, "Enter a start time"),
  endTime: z.string().refine(isTimeKey, "Enter an end time"),
  location: optionalText(200),
  assignedTo: optionalUuid,
  notes: optionalText(4000),
  vehicleId: optionalUuid,
  customerId: optionalUuid,
  enquiryId: optionalUuid,
  submissionId: optionalUuid,
  saleId: optionalUuid,
  acknowledgedConflicts: z.string().max(4000).optional(),
  overrideReason: optionalText(500),
  /** updated_at when the form was opened, for compare-and-set. */
  updatedAt: z.string().max(64).optional(),
  notifyCustomer: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
});

export type AppointmentFormInput = z.infer<typeof appointmentFormSchema>;

export type AppointmentTimes = { start: string; end: string };
export type TimeResult = { ok: true; times: AppointmentTimes } | { ok: false; field: "startTime" | "endTime"; message: string };

/** Convert the form's London date and times to UTC. The end must be after the start on the same day. */
export function appointmentTimes(date: string, startTime: string, endTime: string): TimeResult {
  if (clockChangeNote(date, startTime) === "skipped") return { ok: false, field: "startTime", message: `${startTime} does not exist on this date because the clocks go forward. Choose 02:00 or later.` };
  if (clockChangeNote(date, endTime) === "skipped") return { ok: false, field: "endTime", message: `${endTime} does not exist on this date because the clocks go forward. Choose 02:00 or later.` };
  const start = londonToUtc(date, startTime);
  // A repeated hour (clocks go back) ends on its later occurrence when that keeps it after the start.
  const endEarlier = londonToUtc(date, endTime);
  const endLater = londonToUtc(date, endTime, { occurrence: "later" });
  if (!start || !endEarlier || !endLater) return { ok: false, field: "startTime", message: "Enter a valid date and time" };
  const end = endEarlier.getTime() > start.getTime() ? endEarlier : endLater;
  if (end.getTime() <= start.getTime()) return { ok: false, field: "endTime", message: "The end time must be after the start time" };
  if (end.getTime() - start.getTime() > 16 * 3_600_000) return { ok: false, field: "endTime", message: "Appointments can last up to 16 hours" };
  return { ok: true, times: { start: start.toISOString(), end: end.toISOString() } };
}

export const cancelFormSchema = z.object({
  id: z.uuid(),
  updatedAt: z.string().max(64).optional(),
  reason: z.string().trim().min(3, "Give a short reason for cancelling").max(500, "Keep the reason under 500 characters"),
  notifyCustomer: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
});

const overrideFields = {
  acknowledgedConflicts: z.string().max(4000).optional(),
  overrideReason: optionalText(500),
};

export const assignBookingSchema = z.object({
  bookingId: z.uuid(),
  assignedTo: optionalUuid,
  ...overrideFields,
});

export const viewingActionSchema = z.object({
  id: z.uuid(),
  updatedAt: z.string().max(64).optional(),
  ...overrideFields,
});

export const proposeTimeSchema = z.object({
  id: z.uuid(),
  updatedAt: z.string().max(64).optional(),
  ...overrideFields,
  date: z.string().refine(isDateKey, "Enter a valid date"),
  startTime: z.string().refine(isTimeKey, "Enter a time"),
  message: optionalText(500),
});

export const declineSchema = z.object({
  id: z.uuid(),
  updatedAt: z.string().max(64).optional(),
  reason: z.string().trim().min(3, "Give a short reason").max(500, "Keep the reason under 500 characters"),
});

/** Adds minutes to an HH:mm time, stopping at 23:59. */
export function addMinutesToTime(time: string, minutes: number) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, hour * 60 + minute + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Reads the `start` query parameter ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm", London time). */
export function parseStartParam(value: string | undefined, fallbackDate: string) {
  const [date, time] = (value || "").split("T");
  return { date: isDateKey(date) ? date : fallbackDate, time: isTimeKey(time?.slice(0, 5)) ? (time as string).slice(0, 5) : "09:00" };
}

export function defaultTitle(kind: AppointmentKind, vehicleLabel?: string | null) {
  const vehicle = vehicleLabel?.split(" · ")[0];
  return vehicle ? `${diaryTypeLabels[kind]}: ${vehicle}` : diaryTypeLabels[kind];
}

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
