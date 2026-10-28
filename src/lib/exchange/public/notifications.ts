import "server-only";

import { approvedEnquiryFallbackReplyTo } from "@/lib/email/identity";
import { getResendConfig, sendTransactionalEmail } from "@/lib/email/resend";
import type { RenderedEmail } from "@/lib/email/templates/components";
import { getEnquiryReplyAddress } from "@/lib/enquiries/thread-repository";
import { getExchangeNotificationRecipients } from "@/lib/exchange/settings";
import { createAdminClient } from "@/lib/supabase/server";

type Message = { subject: string; email: RenderedEmail };

/**
 * Send the staff notification (to every exchange recipient) and, when the
 * customer gave an email address, their acknowledgement. Runs after the
 * enquiry is saved, records every attempt in notification_attempts and sets
 * enquiries.notification_status so failures show for retry in the admin.
 * Never throws and never logs personal data.
 */
export async function sendExchangeNotifications(input: { enquiryId: string; enquiryType: string; staff: Message; customer?: Message & { to: string }; customerEmail?: string }) {
  const admin = createAdminClient();
  const record = async (recipientType: "business" | "customer", status: "sent" | "failed", detail: { providerId?: string | null; errorCode?: string }) => {
    await admin?.from("notification_attempts").insert({ enquiry_id: input.enquiryId, recipient_type: recipientType, status, provider_id: detail.providerId || null, error_code: detail.errorCode || null });
  };

  let status: "sent" | "failed" = "sent";
  const config = getResendConfig();
  const recipients = await getExchangeNotificationRecipients().catch(() => [] as string[]);

  if (!config) {
    await record("business", "failed", { errorCode: "email_not_configured" });
    status = "failed";
  } else if (!recipients.length) {
    await record("business", "failed", { errorCode: "no_recipients" });
    status = "failed";
  } else {
    for (const to of recipients) {
      try {
        const result = await sendTransactionalEmail({ to, subject: input.staff.subject, text: input.staff.email.text, html: input.staff.email.html, replyTo: input.customerEmail || config.replyTo, idempotencyKey: `exchange-staff/${input.enquiryId}/${to}` });
        await record("business", "sent", { providerId: result.data?.id });
      } catch (error) {
        await record("business", "failed", { errorCode: error instanceof Error ? error.name : "unknown" });
        status = "failed";
      }
    }
  }

  if (input.customer) {
    if (!config) {
      await record("customer", "failed", { errorCode: "email_not_configured" });
      status = "failed";
    } else {
      try {
        const replyTo = await getEnquiryReplyAddress(input.enquiryId, input.enquiryType).catch(() => null) || approvedEnquiryFallbackReplyTo;
        const result = await sendTransactionalEmail({ to: input.customer.to, subject: input.customer.subject, text: input.customer.email.text, html: input.customer.email.html, replyTo, idempotencyKey: `exchange-customer/${input.enquiryId}` });
        await record("customer", "sent", { providerId: result.data?.id });
      } catch (error) {
        await record("customer", "failed", { errorCode: error instanceof Error ? error.name : "unknown" });
        status = "failed";
      }
    }
  }

  await admin?.from("enquiries").update({ notification_status: status }).eq("id", input.enquiryId);
  return status;
}
