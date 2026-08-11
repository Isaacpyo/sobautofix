import "server-only";

import { Resend } from "resend";
import { isValidEmailAddress, parseEmailAddress, productionEmailSender, resolveReplyTo } from "@/lib/email/identity";
import { getEnquiryReplyDomain } from "@/lib/enquiries/inbound-config";

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
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

  const result = await new Resend(config.apiKey).emails.send({
    from: config.from,
    to,
    subject: message.subject,
    text: message.text,
    replyTo,
    headers: message.headers,
  }, message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined);
  if (result.error) throw new Error(`Email delivery failed: ${result.error.name}`);
  return result;
}

export function getResendInboundConfig() {
  const replyConfig = getResendReplyConfig();
  const webhookConfig = getResendWebhookConfig();
  if (!replyConfig || !webhookConfig) return null;
  return { ...replyConfig, webhookSecret: webhookConfig.webhookSecret };
}

export function getResendWebhookConfig() {
  const base = getResendConfig();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!base || !webhookSecret) return null;
  return { ...base, webhookSecret };
}

export function getResendReplyConfig() {
  const base = getResendConfig();
  const inboundDomain = getEnquiryReplyDomain();
  if (!base || !inboundDomain) return null;
  return { ...base, inboundDomain };
}

export function verifyResendWebhook(payload: string, headers: { id: string; timestamp: string; signature: string }) {
  const config = getResendWebhookConfig();
  if (!config) throw new Error("Resend delivery webhooks are not configured");
  return new Resend(config.apiKey).webhooks.verify({ payload, headers, webhookSecret: config.webhookSecret });
}

export async function retrieveReceivedEmail(emailId: string) {
  const config = getResendReplyConfig();
  if (!config) throw new Error("Legacy Resend inbound email is not configured");
  const result = await new Resend(config.apiKey).emails.receiving.get(emailId, { html_format: "cid" });
  if (result.error || !result.data) throw new Error("Received email content could not be retrieved");
  return result.data;
}

export async function retrieveSentEmail(emailId: string) {
  const config = getResendConfig();
  if (!config) throw new Error("Transactional email is not configured");
  const result = await new Resend(config.apiKey).emails.get(emailId);
  if (result.error || !result.data) throw new Error("Sent email metadata could not be retrieved");
  return result.data;
}
