export const CLOUDFLARE_EMAIL_HEADERS = {
  timestamp: "x-sob-email-timestamp",
  envelopeFrom: "x-sob-envelope-from",
  envelopeTo: "x-sob-envelope-to",
  rawDigest: "x-sob-email-content-sha256",
  keyId: "x-sob-email-key-id",
  eventId: "x-sob-email-event-id",
  signature: "x-sob-email-signature",
  failureStage: "x-sob-email-failure-stage",
} as const;

export const CLOUDFLARE_EMAIL_MAX_BYTES = 4 * 1024 * 1024;
export const CLOUDFLARE_EMAIL_MAX_SKEW_SECONDS = 5 * 60;

export function normalizeEnvelopeAddress(value: string) {
  return value.trim().toLowerCase();
}

export function cloudflareEmailCanonicalPayload(input: {
  timestamp: string;
  envelopeFrom: string;
  envelopeTo: string;
  rawDigest: string;
}) {
  return [
    input.timestamp,
    normalizeEnvelopeAddress(input.envelopeFrom),
    normalizeEnvelopeAddress(input.envelopeTo),
    input.rawDigest.toLowerCase(),
  ].join("\n");
}

export function cloudflareEmailEventPayload(input: { envelopeFrom: string; envelopeTo: string; rawDigest: string }) {
  return [
    "cloudflare",
    normalizeEnvelopeAddress(input.envelopeFrom),
    normalizeEnvelopeAddress(input.envelopeTo),
    input.rawDigest.toLowerCase(),
  ].join("\n");
}

export function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}
