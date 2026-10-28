"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DiaryFormState } from "@/lib/diary/form-state";
import { retryEnquiryNotificationNow, runNotificationRetrySweep } from "@/lib/notifications/retry-sweep";
import { requireStaffAction, StaffPermissionError } from "@/lib/exchange/staff";

// "Retry now" for failed exchange enquiry notifications. Sales staff retry
// sales enquiries, buying staff retry buying enquiries.

function describe(result: { sent: number; failed: number; retried: number; skipped: number }) {
  if (!result.retried) return "Nothing was due for a retry.";
  return `${result.retried} retried: ${result.sent} sent, ${result.failed} still failing.`;
}

export async function retryNotificationNowAction(_previous: DiaryFormState, formData: FormData): Promise<DiaryFormState> {
  const parsed = z.object({ enquiryId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "This enquiry could not be found." };
  try {
    const staff = await requireStaffAction("exchange.view");
    const { data } = await staff.client.from("enquiries").select("type").eq("id", parsed.data.enquiryId).maybeSingle();
    const type = (data as { type?: string } | null)?.type;
    const allowed = type === "vehicle_sales" ? staff.can("sales.manage") : type === "vehicle_purchase" ? staff.can("buying.manage") : false;
    if (!allowed) return { status: "error", message: "You do not have permission to do that." };
    const result = await retryEnquiryNotificationNow(staff.client, parsed.data.enquiryId);
    revalidatePath("/admin/today");
    if (result.schemaMissing) return { status: "error", message: "Notification retries need the latest database update." };
    if (result.sent) return { status: "saved", message: "Notification sent." };
    if (result.skipped) return { status: "saved", message: "This notification no longer needs a retry." };
    return { status: "error", message: "Still failing. It stays on this list so nothing is lost." };
  } catch (error) {
    if (error instanceof StaffPermissionError) return { status: "error", message: error.message };
    throw error;
  }
}

export async function runRetrySweepNowAction(_previous: DiaryFormState): Promise<DiaryFormState> {
  try {
    const staff = await requireStaffAction("sales.manage");
    const result = await runNotificationRetrySweep(staff.client);
    revalidatePath("/admin/today");
    if (result.schemaMissing) return { status: "error", message: "Notification retries need the latest database update." };
    return { status: result.failed ? "error" : "saved", message: describe(result) };
  } catch (error) {
    if (error instanceof StaffPermissionError) return { status: "error", message: error.message };
    throw error;
  }
}
