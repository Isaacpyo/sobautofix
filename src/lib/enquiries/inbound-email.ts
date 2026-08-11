import "server-only";

import PostalMime, { type Address, type Mailbox } from "postal-mime";
import { extractMessageIds } from "./email-threading";

export type InboundEmailTransport = "cloudflare" | "resend";

export type NormalizedInboundEmail = {
  transport: InboundEmailTransport;
  transportEventId: string;
  envelopeFrom: string;
  envelopeRecipients: string[];
  from: string;
  recipients: string[];
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  text: string | null;
  html: string | null;
  headers: Record<string, string>;
  createdAt: string;
  attachmentCount: number;
};

export async function parseCloudflareInboundEmail(input: {
  raw: Uint8Array;
  eventId: string;
  envelopeFrom: string;
  envelopeTo: string;
  receivedAt?: string;
}): Promise<NormalizedInboundEmail> {
  if (!input.raw.byteLength) throw new Error("Inbound MIME body is empty");
  const parsed = await PostalMime.parse(input.raw, {
    maxHeadersSize: 256 * 1024,
    maxNestingDepth: 50,
    maxRfc822NestingDepth: 3,
  });
  const headers = headersToRecord(parsed.headers);
  const from = addressToString(parsed.from) || headers.from || input.envelopeFrom;
  const recipients = uniqueAddresses([
    input.envelopeTo,
    ...addressesToStrings(parsed.to),
    ...addressesToStrings(parsed.cc),
  ]);
  const createdAt = input.receivedAt || new Date().toISOString();

  return {
    transport: "cloudflare",
    transportEventId: input.eventId,
    envelopeFrom: input.envelopeFrom,
    envelopeRecipients: [input.envelopeTo],
    from,
    recipients,
    messageId: parsed.messageId?.trim() || null,
    inReplyTo: parsed.inReplyTo?.trim() || null,
    references: extractMessageIds(parsed.references),
    subject: parsed.subject?.trim() || "No subject",
    text: parsed.text || null,
    html: parsed.html || null,
    headers,
    createdAt,
    attachmentCount: parsed.attachments.length,
  };
}

function headersToRecord(headers: Array<{ key: string; value: string }>) {
  const record: Record<string, string> = {};
  for (const header of headers) {
    const key = header.key.toLowerCase();
    record[key] = record[key] ? `${record[key]}, ${header.value}` : header.value;
  }
  return record;
}

function addressesToStrings(addresses: Address[] | undefined) {
  return (addresses || []).flatMap((address) => "group" in address && address.group
    ? address.group.map(mailboxToString)
    : [mailboxToString(address as Mailbox)]);
}

function addressToString(address: Address | undefined) {
  if (!address) return "";
  if ("group" in address && address.group) return address.group.map(mailboxToString).join(", ");
  return mailboxToString(address as Mailbox);
}

function mailboxToString(mailbox: Mailbox) {
  return mailbox.name ? `${mailbox.name} <${mailbox.address}>` : mailbox.address;
}

function uniqueAddresses(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}
