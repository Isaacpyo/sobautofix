"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { revalidateExchangeAdmin } from "@/lib/exchange/admin/core";
import { addInternalNote, sendEnquiryReply, type ReplyState } from "@/lib/enquiries/thread-repository";
import { requireStaffAction, StaffPermissionError } from "@/lib/exchange/staff";

/**
 * Replies and notes on exchange enquiries use the existing email-thread
 * service (sendEnquiryReply). The staff member needs the pipeline's permission.
 */
async function staffForEnquiry(enquiryId: string) {
  const staff = await requireStaffAction("exchange.view");
  const { data } = await staff.client.from("enquiries").select("type").eq("id", enquiryId).maybeSingle();
  if (!data) throw new Error("Enquiry could not be loaded");
  const permission = data.type === "vehicle_purchase" ? "buying.manage" : "sales.manage";
  if (!staff.can(permission)) throw new StaffPermissionError();
  return staff;
}

function refresh(enquiryId: string) {
  revalidateExchangeAdmin();
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath("/admin/enquiries");
}

export async function sendExchangeReplyAction(previous: ReplyState, formData: FormData): Promise<ReplyState> {
  const enquiryId = String(formData.get("enquiryId") || "");
  const draft = String(formData.get("body") || "");
  const clientRequestId = String(formData.get("clientRequestId") || previous.clientRequestId || "");
  try {
    const staff = await staffForEnquiry(enquiryId);
    await sendEnquiryReply({ enquiryId, body: draft, clientRequestId, actorId: staff.userId, actorName: staff.displayName });
    refresh(enquiryId);
    return { status: "sent", message: "Reply sent to the customer.", draft: "", clientRequestId: crypto.randomUUID() };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: error instanceof StaffPermissionError ? error.message : error instanceof Error && error.name !== "ZodError" && !("code" in error) ? error.message : "Write a reply before sending, then try again.", draft, clientRequestId };
  }
}

export async function saveExchangeNoteAction(previous: ReplyState, formData: FormData): Promise<ReplyState> {
  const enquiryId = String(formData.get("enquiryId") || "");
  const draft = String(formData.get("body") || "");
  try {
    const staff = await staffForEnquiry(enquiryId);
    await addInternalNote({ enquiryId, body: draft, actorId: staff.userId, actorName: staff.displayName });
    refresh(enquiryId);
    return { status: "sent", message: "Internal note saved. It was not emailed.", draft: "", clientRequestId: crypto.randomUUID() };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: error instanceof StaffPermissionError ? error.message : "The note could not be saved.", draft, clientRequestId: previous.clientRequestId };
  }
}
