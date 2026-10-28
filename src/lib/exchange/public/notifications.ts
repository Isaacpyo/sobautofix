import "server-only";

import { approvedEnquiryFallbackReplyTo } from "@/lib/email/identity";
import { getResendConfig, sendTransactionalEmail, TransactionalEmailDeliveryError, type TransactionalEmail } from "@/lib/email/resend";
import type { RenderedEmail } from "@/lib/email/templates/components";
import { getEnquiryReplyAddress } from "@/lib/enquiries/thread-repository";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { getExchangeNotificationRecipients } from "@/lib/exchange/settings";
import { createAdminClient } from "@/lib/supabase/server";

type Message = { subject: string; email: RenderedEmail };

/** Minutes until the reliability sweep retries a failed notification (DELIVERY.md, bounded at 3 attempts). */
export const NOTIFICATION_RETRY_MINUTES = 15;

/** Whether a send failure is worth one immediate retry (network or provider hiccup, not a rejection). */
export function isTransientEmailError(error: unknown) {
  if (error instanceof TransactionalEmailDeliveryError) return error.retryable;
  // Unknown errors (network resets, timeouts) are treated as transient.
  return !(error instanceof Error && /not configured/i.test(error.message));
}

async function sendWithOneRetry(message: TransactionalEmail, wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))) {
  try {
    return await sendTransactionalEmail(message);
  } catch (error) {
    if (!isTransientEmailError(error)) throw error;
    await wait(400);
    return sendTransactionalEmail(message);
  }
}

/**
 * Send the staff notification (to every exchange recipient) and, when the
 * customer gave an email address, their acknowledgement. Runs only after the
 * enquiry is saved. Every attempt is recorded in notification_attempts. On
 * failure the enquiry is marked for the retry sweep: notification_status
 * 'failed', notification_attempt_count incremented and
 * notification_next_retry_at set 15 minutes ahead. Never throws and never
 * logs personal data.
 */
export async function sendExchangeNotifications(input: { enquiryId: string; enquiryType: string; staff: Message; customer?: Message & { to: string }; customerEmail?: string }) {
  const admin = createAdminClient();
  const record = async (recipientType: "business" | "customer", status: "sent" | "failed", detail: { providerId?: string | null; errorCode?: string }) => {
    await admin?.from("notification_attempts").insert({ enquiry_id: input.enquiryId, recipient_type: recipientType, status, provider_id: detail.providerId || null, error_code: detail.errorCode || null });
  };
  const errorCode = (error: unknown) => (error instanceof TransactionalEmailDeliveryError ? error.code : error instanceof Error ? error.name : "unknown");

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
        const result = await sendWithOneRetry({ to, subject: input.staff.subject, text: input.staff.email.text, html: input.staff.email.html, replyTo: input.customerEmail || config.replyTo, idempotencyKey: `exchange-staff/${input.enquiryId}/${to}` });
        await record("business", "sent", { providerId: result.data?.id });
      } catch (error) {
        await record("business", "failed", { errorCode: errorCode(error) });
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
        const result = await sendWithOneRetry({ to: input.customer.to, subject: input.customer.subject, text: input.customer.email.text, html: input.customer.email.html, replyTo, idempotencyKey: `exchange-customer/${input.enquiryId}` });
        await record("customer", "sent", { providerId: result.data?.id });
      } catch (error) {
        await record("customer", "failed", { errorCode: errorCode(error) });
        status = "failed";
      }
    }
  }

  await markNotificationOutcome(input.enquiryId, status);
  return status;
}

/** Record the outcome on the enquiry, falling back to the status alone on a database without migration 090300. */
async function markNotificationOutcome(enquiryId: string, status: "sent" | "failed", now = new Date()) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data, error } = await admin.from("enquiries").select("notification_attempt_count").eq("id", enquiryId).maybeSingle();
  if (error && isMissingSchemaError(error)) {
    await admin.from("enquiries").update({ notification_status: status }).eq("id", enquiryId);
    return;
  }
  const attempts = ((data as { notification_attempt_count?: number } | null)?.notification_attempt_count || 0) + 1;
  const { error: updateError } = await admin.from("enquiries").update({
    notification_status: status,
    notification_attempt_count: attempts,
    notification_next_retry_at: status === "failed" ? new Date(now.getTime() + NOTIFICATION_RETRY_MINUTES * 60_000).toISOString() : null,
  }).eq("id", enquiryId);
  if (updateError) await admin.from("enquiries").update({ notification_status: status }).eq("id", enquiryId);
}
