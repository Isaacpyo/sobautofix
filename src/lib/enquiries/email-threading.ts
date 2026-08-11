import { z } from "zod";

const emailSchema = z.email();

export function conversationSubject(enquiryType: string) {
  return `Re: Your SOB Autofix ${enquiryType.replaceAll("_", " ")} enquiry`.slice(0, 180);
}

export function buildEnquiryReplyAddress(token: string, inboundDomain: string) {
  return `enquiry+${z.string().uuid().parse(token)}@${inboundDomain.toLowerCase()}`;
}

export function extractReplyToken(recipients: string[], inboundDomain: string) {
  const escaped = inboundDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`^enquiry\\+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@${escaped}$`, "i");
  for (const recipient of recipients) {
    const match = recipient.trim().match(matcher);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

export async function resolveInboundThread(input: {
  recipients: string[];
  inboundDomain: string;
  inReplyTo: string | null;
  references: string[];
  findByToken(token: string): Promise<string | null>;
  findByMessageIds(messageIds: string[]): Promise<string | null>;
}) {
  const token = extractReplyToken(input.recipients, input.inboundDomain);
  if (token) {
    const enquiryId = await input.findByToken(token);
    if (enquiryId) return { enquiryId, reason: "reply_token" as const };
  }

  const inReplyToIds = extractMessageIds(input.inReplyTo);
  if (inReplyToIds.length) {
    const enquiryId = await input.findByMessageIds(inReplyToIds);
    if (enquiryId) return { enquiryId, reason: "in_reply_to" as const };
  }

  const referenceIds = [...new Set(input.references)];
  if (referenceIds.length) {
    const enquiryId = await input.findByMessageIds(referenceIds);
    if (enquiryId) return { enquiryId, reason: "references" as const };
  }

  return null;
}

export function headerValue(headers: Record<string, string> | null | undefined, name: string) {
  const target = name.toLowerCase();
  return Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target)?.[1]?.trim() || null;
}

export function extractMessageIds(value: string | null | undefined) {
  return [...new Set((value?.match(/<[^<>\s]+>/g) || []).slice(0, 50))];
}

export function parseSenderEmail(value: string) {
  const bracketed = value.match(/<([^<>]+)>/)?.[1] || value.trim();
  return emailSchema.parse(bracketed.toLowerCase());
}

export function isAutomatedEmail(headers: Record<string, string> | null | undefined, sender: string, subject: string) {
  const autoSubmitted = headerValue(headers, "auto-submitted")?.toLowerCase();
  const precedence = headerValue(headers, "precedence")?.toLowerCase();
  return Boolean(
    (autoSubmitted && autoSubmitted !== "no") ||
    (precedence && ["bulk", "junk", "list", "auto_reply"].includes(precedence)) ||
    /(?:mailer-daemon|postmaster)@/i.test(sender) ||
    /^(?:automatic reply|auto(?:matic)?[- ]reply|out of office|undeliverable)\b/i.test(subject.trim()),
  );
}

export function safeInboundText(text: string | null | undefined, html: string | null | undefined) {
  const source = text || htmlToPlainText(html || "");
  return source.replaceAll("\0", "").replace(/\r\n/g, "\n").trim().slice(0, 50000);
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<(script|style|iframe|object)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\n{3,}/g, "\n\n");
}
