"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { success, type FormState } from "@/components/admin/exchange/form-state";
import { ExchangeUserError, must, parseForm, revalidateExchangeAdmin, runStaffAction, uuidField } from "@/lib/exchange/admin/core";
import { retryEnquiryNotifications } from "@/lib/enquiries/repository";
import { auditStaffAction } from "@/lib/exchange/staff";

/** Overview: retry the notification emails of an exchange enquiry whose first send failed. */
export async function retryExchangeNotificationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("exchange.view", formData, async (staff) => {
    const { enquiryId } = parseForm(z.object({ enquiryId: uuidField("enquiry") }), formData);
    const enquiry = must(await staff.client.from("enquiries").select("id,type,notification_status").eq("id", enquiryId).maybeSingle(), "The enquiry could not be loaded.");
    if (!enquiry) throw new ExchangeUserError("That enquiry no longer exists.");
    if (!(enquiry.type === "vehicle_purchase" ? staff.can("buying.manage") : staff.can("sales.manage"))) throw new ExchangeUserError("You do not have permission to resend this notification.");
    let status: string;
    try {
      status = await retryEnquiryNotifications(enquiryId);
    } catch {
      throw new ExchangeUserError("The notification could not be resent. Check the email settings and try again.");
    }
    await auditStaffAction(staff, "notification_retry", "enquiry", enquiryId, { status });
    revalidateExchangeAdmin();
    revalidatePath("/admin/notifications");
    if (status !== "sent") throw new ExchangeUserError("The email service did not accept the notification. It is still marked as failed.");
    return success("Notification sent.");
  });
}
