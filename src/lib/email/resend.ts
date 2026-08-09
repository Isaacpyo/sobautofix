import "server-only";

import { Resend } from "resend";
import { isValidEmailAddress, parseEmailAddress, productionEmailSender, resolveReplyTo } from "@/lib/email/identity";

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;
  const notificationRecipient = process.env.ENQUIRY_NOTIFICATION_EMAIL;

  if (
    !apiKey ||
    from !== productionEmailSender ||
    !replyTo ||
    !notificationRecipient ||
    !isValidEmailAddress(replyTo) ||
    !isValidEmailAddress(notificationRecipient)
  ) return null;

  return {
    apiKey,
    from,
    replyTo,
    notificationRecipient,
  };
}

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const config = getResendConfig();
  if (!config) throw new Error("Transactional email is not configured");
  const to = parseEmailAddress(message.to);
  const replyTo = resolveReplyTo(config.replyTo, message.replyTo);

  return new Resend(config.apiKey).emails.send({
    from: config.from,
    to,
    subject: message.subject,
    text: message.text,
    replyTo,
  });
}
