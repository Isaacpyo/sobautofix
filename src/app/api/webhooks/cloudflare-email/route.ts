import { NextResponse } from "next/server";
import {
  createCloudflareEmailEventId,
  createCloudflareEmailKeyId,
  digestCloudflareEmail,
  isFreshCloudflareEmailTimestamp,
  verifyCloudflareEmailSignature,
} from "@/lib/enquiries/cloudflare-email-auth";
import { CLOUDFLARE_EMAIL_HEADERS, CLOUDFLARE_EMAIL_MAX_BYTES } from "@/lib/enquiries/cloudflare-email-protocol";
import { getCloudflareInboundConfig } from "@/lib/enquiries/inbound-config";
import { parseCloudflareInboundEmail } from "@/lib/enquiries/inbound-email";
import { beginInboundEmailEvent, finishInboundEmailEvent, processNormalizedInboundEmail } from "@/lib/enquiries/thread-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getCloudflareInboundConfig();
  if (!config) return NextResponse.json({ error: "Inbound email is not configured" }, { status: 503 });

  const timestamp = request.headers.get(CLOUDFLARE_EMAIL_HEADERS.timestamp);
  const envelopeFrom = request.headers.get(CLOUDFLARE_EMAIL_HEADERS.envelopeFrom);
  const envelopeTo = request.headers.get(CLOUDFLARE_EMAIL_HEADERS.envelopeTo);
  const suppliedRawDigest = request.headers.get(CLOUDFLARE_EMAIL_HEADERS.rawDigest);
  const suppliedKeyId = request.headers.get(CLOUDFLARE_EMAIL_HEADERS.keyId);
  const eventId = request.headers.get(CLOUDFLARE_EMAIL_HEADERS.eventId);
  const signature = request.headers.get(CLOUDFLARE_EMAIL_HEADERS.signature);
  if (!timestamp || !envelopeFrom || !envelopeTo || !suppliedRawDigest || !suppliedKeyId || !eventId || !signature) {
    return authenticationFailure("headers");
  }
  if (!isFreshCloudflareEmailTimestamp(timestamp)) {
    return authenticationFailure("timestamp");
  }
  if (suppliedKeyId !== createCloudflareEmailKeyId(config.webhookSecret)) {
    return authenticationFailure("key");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("message/rfc822")) {
    return NextResponse.json({ error: "Unsupported email payload" }, { status: 415 });
  }
  const contentLength = parseContentLength(request.headers.get("content-length"));
  if (contentLength !== null && contentLength > CLOUDFLARE_EMAIL_MAX_BYTES) {
    return NextResponse.json({ error: "Email payload is too large" }, { status: 413 });
  }

  const raw = await readRawBody(request.body);
  if (!raw) return NextResponse.json({ error: "Email payload is too large" }, { status: 413 });
  if (!raw.byteLength) return NextResponse.json({ error: "Email payload is empty" }, { status: 400 });
  const rawDigest = digestCloudflareEmail(raw);
  if (suppliedRawDigest !== rawDigest) {
    return authenticationFailure("digest");
  }
  if (!verifyCloudflareEmailSignature({
    secret: config.webhookSecret,
    timestamp,
    envelopeFrom,
    envelopeTo,
    rawDigest,
    signature,
  })) {
    return authenticationFailure("signature");
  }

  const expectedEventId = createCloudflareEmailEventId({ envelopeFrom, envelopeTo, rawDigest });
  if (eventId !== expectedEventId) {
    return authenticationFailure("event");
  }
  if (recipientDomain(envelopeTo) !== config.replyDomain) {
    return NextResponse.json({ error: "Invalid inbound recipient" }, { status: 400 });
  }

  let receipt: Awaited<ReturnType<typeof beginInboundEmailEvent>>;
  try {
    receipt = await beginInboundEmailEvent(eventId, rawDigest);
  } catch {
    return NextResponse.json({ error: "Inbound email is temporarily unavailable" }, { status: 503 });
  }
  if (!receipt.process) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const email = await parseCloudflareInboundEmail({ raw, eventId, envelopeFrom, envelopeTo });
    const result = await processNormalizedInboundEmail(email);
    await finishInboundEmailEvent(receipt.admin, eventId, result.matched ? "processed" : "ignored");
    return NextResponse.json({ ok: true, matched: result.matched });
  } catch (error) {
    try {
      await finishInboundEmailEvent(receipt.admin, eventId, "failed", error instanceof Error ? error.name : "unknown");
    } catch { /* the non-2xx response allows Cloudflare to retry safely */ }
    return NextResponse.json({ error: "Inbound email processing failed" }, { status: 500 });
  }
}

function authenticationFailure(stage: "headers" | "timestamp" | "key" | "digest" | "signature" | "event") {
  return NextResponse.json(
    { error: "Invalid webhook signature" },
    { status: 401, headers: { [CLOUDFLARE_EMAIL_HEADERS.failureStage]: stage } },
  );
}

function recipientDomain(address: string) {
  const normalized = address.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1 || normalized.includes(" ")) return null;
  return normalized.slice(separator + 1);
}

function parseContentLength(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function readRawBody(body: ReadableStream<Uint8Array> | null) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > CLOUDFLARE_EMAIL_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const raw = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return raw;
}
