import {
  CLOUDFLARE_EMAIL_HEADERS,
  CLOUDFLARE_EMAIL_MAX_BYTES,
  bytesToHex,
  cloudflareEmailCanonicalPayload,
  cloudflareEmailEventPayload,
  normalizeEnvelopeAddress,
} from "../../../src/lib/enquiries/cloudflare-email-protocol";

type WorkerEnvironment = {
  CLOUDFLARE_EMAIL_WEBHOOK_SECRET: string;
  SOB_AUTOFIX_INBOUND_ENDPOINT: string;
};

type EmailMessage = {
  from: string;
  to: string;
  raw: ReadableStream<Uint8Array>;
  rawSize: number;
  setReject(reason: string): void;
};

const enquiryEmailWorker = {
  async email(message: EmailMessage, env: WorkerEnvironment, context: unknown) {
    void context;
    if (recipientDomain(message.to) !== "reply.sobautofix.com") {
      message.setReject("This address does not accept email.");
      return;
    }
    if (!Number.isSafeInteger(message.rawSize) || message.rawSize <= 0 || message.rawSize > CLOUDFLARE_EMAIL_MAX_BYTES) {
      message.setReject("This email is too large or empty.");
      return;
    }
    if (!env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET || env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET.length < 32) {
      throw new Error("Inbound email authentication is not configured");
    }

    const endpoint = validatedEndpoint(env.SOB_AUTOFIX_INBOUND_ENDPOINT);
    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    if (raw.byteLength !== message.rawSize || raw.byteLength > CLOUDFLARE_EMAIL_MAX_BYTES) {
      throw new Error("Inbound email size changed during transfer");
    }
    const envelopeFrom = normalizeEnvelopeAddress(message.from);
    const envelopeTo = normalizeEnvelopeAddress(message.to);
    const rawDigest = await sha256Hex(raw);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const eventId = `cf_${await sha256Hex(new TextEncoder().encode(cloudflareEmailEventPayload({ envelopeFrom, envelopeTo, rawDigest })))}`;
    const signature = `v1=${await hmacSha256Hex(
      env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET,
      cloudflareEmailCanonicalPayload({ timestamp, envelopeFrom, envelopeTo, rawDigest }),
    )}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "message/rfc822",
        [CLOUDFLARE_EMAIL_HEADERS.timestamp]: timestamp,
        [CLOUDFLARE_EMAIL_HEADERS.envelopeFrom]: envelopeFrom,
        [CLOUDFLARE_EMAIL_HEADERS.envelopeTo]: envelopeTo,
        [CLOUDFLARE_EMAIL_HEADERS.eventId]: eventId,
        [CLOUDFLARE_EMAIL_HEADERS.signature]: signature,
      },
      body: raw,
    });
    if (!response.ok) {
      const failureStage = response.headers.get(CLOUDFLARE_EMAIL_HEADERS.failureStage);
      const detail = failureStage ? ` at ${failureStage}` : "";
      throw new Error(`Inbound endpoint rejected the message with status ${response.status}${detail}`);
    }
  },
};

export default enquiryEmailWorker;

async function sha256Hex(value: Uint8Array) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", Uint8Array.from(value).buffer));
}

async function hmacSha256Hex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function recipientDomain(address: string) {
  const normalized = normalizeEnvelopeAddress(address);
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1 || normalized.includes(" ")) return null;
  return normalized.slice(separator + 1);
}

function validatedEndpoint(value: string) {
  const endpoint = new URL(value);
  if (
    endpoint.protocol !== "https:"
    || endpoint.hostname !== "sobautofix.com"
    || endpoint.pathname !== "/api/webhooks/cloudflare-email"
    || endpoint.search
    || endpoint.hash
  ) throw new Error("Inbound endpoint is invalid");
  return endpoint.toString();
}
