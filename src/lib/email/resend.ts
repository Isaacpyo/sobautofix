import "server-only";

import { Resend } from "resend";
import {
  approvedInvoiceReplyTo,
  isValidEmailAddress,
  parseEmailAddress,
  productionEmailSender,
  resolveReplyTo,
} from "@/lib/email/identity";
import { getEnquiryReplyDomain } from "@/lib/enquiries/inbound-config";

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  idempotencyKey?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
};

export type TransactionalEmailFailureKind = "rejected" | "ambiguous";

export class TransactionalEmailDeliveryError extends Error {
  constructor(
    readonly kind: TransactionalEmailFailureKind,
    readonly code: string,
    readonly retryable: boolean,
    message = `Email delivery failed: ${code}`,
  ) {
    super(message);
    this.name = "TransactionalEmailDeliveryError";
  }
}

type ResendConfiguration = {
  apiKey: string;
  from: string;
  replyTo: string;
};

function getBaseResendConfig(): ResendConfiguration | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;

  if (!apiKey || from !== productionEmailSender || !replyTo || !isValidEmailAddress(replyTo)) return null;
  return { apiKey, from, replyTo };
}

export function getResendConfig() {
  const base = getBaseResendConfig();
  const notificationRecipient = process.env.ENQUIRY_NOTIFICATION_EMAIL;

  if (!base || !notificationRecipient || !isValidEmailAddress(notificationRecipient)) return null;

  return {
    ...base,
    notificationRecipient,
  };
}

export function getInvoiceResendConfig() {
  const base = getBaseResendConfig();
  if (!base || base.replyTo !== approvedInvoiceReplyTo) return null;
  return { ...base, replyTo: approvedInvoiceReplyTo };
}

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const config = getResendConfig();
  if (!config) throw new TransactionalEmailDeliveryError("rejected", "email_not_configured", false, "Transactional email is not configured");
  return sendWithConfig(config, message);
}

export async function sendInvoiceTransactionalEmail(message: TransactionalEmail) {
  const config = getInvoiceResendConfig();
  if (!config) throw new TransactionalEmailDeliveryError("rejected", "invoice_email_not_configured", false, "Invoice email is not configured");
  return sendWithConfig(config, { ...message, replyTo: approvedInvoiceReplyTo });
}

async function sendWithConfig(config: ResendConfiguration, message: TransactionalEmail) {
  let to: string;
  let replyTo: string;
  try {
    to = parseEmailAddress(message.to);
    replyTo = resolveReplyTo(config.replyTo, message.replyTo);
  } catch {
    throw new TransactionalEmailDeliveryError("rejected", "invalid_recipient", false);
  }

  const result = await new Resend(config.apiKey).emails.send({
    from: config.from,
    to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo,
    headers: message.headers,
    tags: message.tags,
    attachments: message.attachments,
  }, message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined);
  if (result.error) throw classifyTransactionalEmailProviderError(result.error);
  return result;
}

export function classifyTransactionalEmailProviderError(error: { name: string; statusCode: number | null }) {
  const code = /^[a-z0-9_]+$/.test(error.name) ? error.name : "provider_error";
  if (code === "invalid_idempotent_request") {
    return new TransactionalEmailDeliveryError("ambiguous", code, false);
  }
  if (error.statusCode === null || error.statusCode === 408 || error.statusCode >= 500 || code === "concurrent_idempotent_requests") {
    return new TransactionalEmailDeliveryError("ambiguous", code, true);
  }
  const retryable = code === "rate_limit_exceeded";
  return new TransactionalEmailDeliveryError("rejected", code, retryable);
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
