"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { toFormState, type DiaryFormState } from "@/lib/diary/form-state";
import { declineSchema, fieldErrors, proposeTimeSchema, viewingActionSchema } from "@/lib/diary/schema";
import { confirmViewing, declineViewing, proposeViewingTime, retryViewingEmail } from "@/lib/diary/service";
import { requireStaffAction, StaffPermissionError, type StaffContext } from "@/lib/exchange/staff";

// Confirming, moving or declining a customer's viewing request contacts the
// customer, so it needs the sales permission, not just diary access.

async function salesStaff(): Promise<StaffContext | DiaryFormState> {
  try {
    return await requireStaffAction("sales.manage");
  } catch (error) {
    if (error instanceof StaffPermissionError) return { status: "error", message: error.message };
    throw error;
  }
}

/**
 * After a successful change the request may leave the list it was shown in,
 * so the outcome (and any email failure) is shown on the page the person
 * returns to. Only ids and outcome words go in the URL.
 */
function done(formData: FormData, id: string, outcome: "confirmed" | "proposed" | "declined", email?: { status: string }) {
  const emailPart = email ? `&email=${email.status}` : "";
  if (formData.get("returnTo") === "diary") redirect(`/admin/diary/${id}?saved=${outcome}${emailPart}`);
  redirect(`/admin/exchange/viewings?done=${outcome}&appointment=${id}${emailPart}`);
}

function refresh(id: string) {
  revalidatePath("/admin/exchange/viewings");
  revalidatePath("/admin/diary");
  revalidatePath(`/admin/diary/${id}`);
  revalidatePath("/admin/today");
}

const idSchema = z.object({ id: z.uuid() });

export async function confirmViewingAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await salesStaff();
  if (!("userId" in staff)) return staff;
  const parsed = viewingActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "This viewing could not be found." };
  const result = await confirmViewing(staff, { id: parsed.data.id, updatedAt: parsed.data.updatedAt, acknowledged: parsed.data.acknowledgedConflicts, reason: parsed.data.overrideReason });
  if (!result.ok) return toFormState(result);
  refresh(parsed.data.id);
  done(formData, parsed.data.id, "confirmed", result.email);
  return toFormState(result);
}

export async function proposeViewingTimeAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await salesStaff();
  if (!("userId" in staff)) return staff;
  const parsed = proposeTimeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choose a date and time.", fieldErrors: fieldErrors(parsed.error) };
  const result = await proposeViewingTime(staff, { ...parsed.data, acknowledged: parsed.data.acknowledgedConflicts, reason: parsed.data.overrideReason });
  if (!result.ok) return toFormState(result);
  refresh(parsed.data.id);
  done(formData, parsed.data.id, "proposed", result.email);
  return toFormState(result);
}

export async function declineViewingAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await salesStaff();
  if (!("userId" in staff)) return staff;
  const parsed = declineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Give a reason for declining.", fieldErrors: fieldErrors(parsed.error) };
  const result = await declineViewing(staff, parsed.data);
  if (!result.ok) return toFormState(result);
  refresh(parsed.data.id);
  done(formData, parsed.data.id, "declined", result.email);
  return toFormState(result);
}

export async function retryViewingEmailAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await salesStaff();
  if (!("userId" in staff)) return staff;
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "This email could not be retried." };
  const outcome = await retryViewingEmail(staff, parsed.data.id);
  refresh(parsed.data.id);
  return outcome.status === "sent" ? { status: "saved", message: outcome.message, email: outcome } : { status: "error", message: outcome.message, email: outcome };
}
