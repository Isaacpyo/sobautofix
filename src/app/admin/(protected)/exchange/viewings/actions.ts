"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toFormState, type DiaryFormState } from "@/lib/diary/form-state";
import { declineSchema, fieldErrors, proposeTimeSchema } from "@/lib/diary/schema";
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
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "This viewing could not be found." };
  const result = await confirmViewing(staff, parsed.data.id);
  if (result.ok) refresh(parsed.data.id);
  return toFormState(result);
}

export async function proposeViewingTimeAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await salesStaff();
  if (!("userId" in staff)) return staff;
  const parsed = proposeTimeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choose a date and time.", fieldErrors: fieldErrors(parsed.error) };
  const result = await proposeViewingTime(staff, parsed.data);
  if (result.ok) refresh(parsed.data.id);
  return toFormState(result);
}

export async function declineViewingAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const staff = await salesStaff();
  if (!("userId" in staff)) return staff;
  const parsed = declineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Give a reason for declining.", fieldErrors: fieldErrors(parsed.error) };
  const result = await declineViewing(staff, parsed.data);
  if (result.ok) refresh(parsed.data.id);
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
