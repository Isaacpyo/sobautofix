import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  CLOUDFLARE_EMAIL_MAX_SKEW_SECONDS,
  cloudflareEmailCanonicalPayload,
  cloudflareEmailEventPayload,
} from "./cloudflare-email-protocol";

const hexDigestPattern = /^[a-f0-9]{64}$/;
const signaturePattern = /^v1=([a-f0-9]{64})$/;

export function digestCloudflareEmail(raw: Uint8Array) {
  return createHash("sha256").update(raw).digest("hex");
}

export function createCloudflareEmailKeyId(secret: string) {
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

export function createCloudflareEmailEventId(input: { envelopeFrom: string; envelopeTo: string; rawDigest: string }) {
  return `cf_${createHash("sha256").update(cloudflareEmailEventPayload(input)).digest("hex")}`;
}

export function signCloudflareEmail(input: {
  secret: string;
  timestamp: string;
  envelopeFrom: string;
  envelopeTo: string;
  rawDigest: string;
}) {
  const signature = createHmac("sha256", input.secret)
    .update(cloudflareEmailCanonicalPayload(input))
    .digest("hex");
  return `v1=${signature}`;
}

export function isFreshCloudflareEmailTimestamp(timestamp: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!/^\d{10}$/.test(timestamp)) return false;
  const value = Number(timestamp);
  return Number.isSafeInteger(value) && Math.abs(nowSeconds - value) <= CLOUDFLARE_EMAIL_MAX_SKEW_SECONDS;
}

export function verifyCloudflareEmailSignature(input: {
  secret: string;
  timestamp: string;
  envelopeFrom: string;
  envelopeTo: string;
  rawDigest: string;
  signature: string;
}) {
  if (!hexDigestPattern.test(input.rawDigest)) return false;
  const suppliedMatch = input.signature.match(signaturePattern);
  if (!suppliedMatch?.[1]) return false;
  const expected = signCloudflareEmail(input).slice(3);
  const supplied = suppliedMatch[1];
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}
