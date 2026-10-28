"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFormState, type DiaryFormState } from "@/lib/diary/form-state";
import type { EmailOutcome } from "@/lib/diary/notifications";
import { canUseLink, linkKinds, searchLinks, type LinkKind, type LinkOption } from "@/lib/diary/repository";
import { appointmentFormSchema, assignBookingSchema, cancelFormSchema, fieldErrors } from "@/lib/diary/schema";
import { assignBookingStaff, cancelAppointment, saveAppointment } from "@/lib/diary/service";
import { requireStaffAction, StaffPermissionError, type StaffContext } from "@/lib/exchange/staff";

async function staffOrError(): Promise<StaffContext | DiaryFormState> {
  try {
    return await requireStaffAction("diary.manage");
  } catch (error) {
    if (error instanceof StaffPermissionError) return { status: "error", message: error.message };
    throw error;
  }
}

function emailParam(email?: EmailOutcome) {
  return email ? `&email=${email.status}` : "";
}

export async function saveAppointmentAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await staffOrError();
  if (!("userId" in staff)) return staff;
  const parsed = appointmentFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const result = await saveAppointment(staff, parsed.data);
  if (!result.ok) return toFormState(result);
  revalidatePath("/admin/diary");
  revalidatePath("/admin/today");
  revalidatePath("/admin/exchange/viewings");
  redirect(`/admin/diary/${result.id}?saved=${parsed.data.id ? "updated" : "created"}${emailParam(result.email)}`);
}

export async function cancelAppointmentAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await staffOrError();
  if (!("userId" in staff)) return staff;
  const parsed = cancelFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Give a reason for cancelling.", fieldErrors: fieldErrors(parsed.error) };
  const result = await cancelAppointment(staff, parsed.data);
  if (!result.ok) return toFormState(result);
  revalidatePath("/admin/diary");
  revalidatePath("/admin/today");
  revalidatePath("/admin/exchange/viewings");
  redirect(`/admin/diary/${result.id}?saved=cancelled${emailParam(result.email)}`);
}

export async function assignBookingStaffAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await staffOrError();
  if (!("userId" in staff)) return staff;
  const parsed = assignBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choose a staff member.", fieldErrors: fieldErrors(parsed.error) };
  const result = await assignBookingStaff(staff, parsed.data);
  if (result.ok) {
    revalidatePath("/admin/diary");
    revalidatePath(`/admin/diary/${parsed.data.bookingId}`);
    revalidatePath("/admin/today");
  }
  return toFormState(result);
}

/** Searches for records to link to an appointment. The query travels in the POST body, never a URL. */
export async function searchDiaryLinksAction(kind: LinkKind, query: string): Promise<{ ok: boolean; options: LinkOption[]; message?: string }> {
  if (!linkKinds.includes(kind) || typeof query !== "string") return { ok: false, options: [], message: "Unknown search." };
  const staff = await staffOrError();
  if (!("userId" in staff)) return { ok: false, options: [], message: staff.message };
  if (!canUseLink(staff.role, kind)) return { ok: false, options: [], message: "Your role cannot link these records." };
  try {
    return { ok: true, options: await searchLinks(staff.client, kind, query.slice(0, 100)) };
  } catch {
    return { ok: false, options: [], message: "Search failed. Try again." };
  }
}
