import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCloudflareEmailEventId,
  digestCloudflareEmail,
  signCloudflareEmail,
} from "@/lib/enquiries/cloudflare-email-auth";
import { CLOUDFLARE_EMAIL_HEADERS } from "@/lib/enquiries/cloudflare-email-protocol";
import { getCloudflareInboundConfig } from "@/lib/enquiries/inbound-config";
import { parseCloudflareInboundEmail } from "@/lib/enquiries/inbound-email";
import { beginInboundEmailEvent, finishInboundEmailEvent, processNormalizedInboundEmail } from "@/lib/enquiries/thread-repository";
import { POST } from "@/app/api/webhooks/cloudflare-email/route";

vi.mock("@/lib/enquiries/inbound-config", () => ({ getCloudflareInboundConfig: vi.fn() }));
vi.mock("@/lib/enquiries/inbound-email", () => ({ parseCloudflareInboundEmail: vi.fn() }));
vi.mock("@/lib/enquiries/thread-repository", () => ({
  beginInboundEmailEvent: vi.fn(),
  finishInboundEmailEvent: vi.fn(),
  processNormalizedInboundEmail: vi.fn(),
}));

const secret = "route-test-secret-that-is-longer-than-thirty-two-characters";
const envelopeFrom = "customer@example.com";
const envelopeTo = "enquiry+9f99f1f0-2252-4b5e-9000-9bc913650f15@reply.sobautofix.com";
const raw = new TextEncoder().encode("From: customer@example.com\r\nSubject: Reply\r\n\r\nHello");

describe("Cloudflare inbound email webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCloudflareInboundConfig).mockReturnValue({ replyDomain: "reply.sobautofix.com", webhookSecret: secret });
    vi.mocked(beginInboundEmailEvent).mockResolvedValue({ process: true, admin: {} as never });
    vi.mocked(parseCloudflareInboundEmail).mockResolvedValue({ transport: "cloudflare" } as never);
    vi.mocked(processNormalizedInboundEmail).mockResolvedValue({ matched: true, enquiryId: "enquiry-1" });
  });

  it("accepts a valid signed MIME message", async () => {
    const response = await POST(signedRequest({ raw, envelopeFrom, envelopeTo }));
    expect(response.status).toBe(200);
    expect(parseCloudflareInboundEmail).toHaveBeenCalledWith(expect.objectContaining({ raw: expect.any(Uint8Array), envelopeFrom, envelopeTo }));
    expect(processNormalizedInboundEmail).toHaveBeenCalledOnce();
    expect(finishInboundEmailEvent).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^cf_/), "processed");
  });

  it("rejects a bad signature, changed MIME, and changed recipient", async () => {
    const badSignature = signedRequest({ raw, envelopeFrom, envelopeTo });
    badSignature.headers.set(CLOUDFLARE_EMAIL_HEADERS.signature, `v1=${"0".repeat(64)}`);
    const badSignatureResponse = await POST(badSignature);
    expect(badSignatureResponse.status).toBe(401);
    expect(badSignatureResponse.headers.get(CLOUDFLARE_EMAIL_HEADERS.failureStage)).toBe("signature");

    const changedMime = signedRequest({ raw, envelopeFrom, envelopeTo, signedRaw: raw });
    const changedBody = new TextEncoder().encode("changed after signing");
    const changedMimeRequest = cloneHeadersWithBody(changedMime, changedBody);
    const changedMimeResponse = await POST(changedMimeRequest);
    expect(changedMimeResponse.status).toBe(401);
    expect(changedMimeResponse.headers.get(CLOUDFLARE_EMAIL_HEADERS.failureStage)).toBe("signature");

    const changedRecipient = signedRequest({ raw, envelopeFrom, envelopeTo });
    changedRecipient.headers.set(CLOUDFLARE_EMAIL_HEADERS.envelopeTo, "attacker@example.com");
    expect((await POST(changedRecipient)).status).toBe(401);
    expect(beginInboundEmailEvent).not.toHaveBeenCalled();
  });

  it("rejects expired timestamps, missing recipients, and a correctly signed wrong domain", async () => {
    expect((await POST(signedRequest({ raw, envelopeFrom, envelopeTo, timestamp: "1700000000" }))).status).toBe(401);
    const missing = signedRequest({ raw, envelopeFrom, envelopeTo });
    missing.headers.delete(CLOUDFLARE_EMAIL_HEADERS.envelopeTo);
    expect((await POST(missing)).status).toBe(401);
    expect((await POST(signedRequest({ raw, envelopeFrom, envelopeTo: "token@example.com" }))).status).toBe(400);
  });

  it("rejects unsupported or oversized payloads before database work", async () => {
    const unsupported = signedRequest({ raw, envelopeFrom, envelopeTo });
    unsupported.headers.set("content-type", "application/json");
    expect((await POST(unsupported)).status).toBe(415);

    const oversized = signedRequest({ raw, envelopeFrom, envelopeTo });
    oversized.headers.set("content-length", String(4 * 1024 * 1024 + 1));
    expect((await POST(oversized)).status).toBe(413);
    expect(beginInboundEmailEvent).not.toHaveBeenCalled();
  });

  it("acknowledges deterministic duplicate events without processing twice", async () => {
    vi.mocked(beginInboundEmailEvent).mockResolvedValue({ process: false, admin: {} as never });
    const response = await POST(signedRequest({ raw, envelopeFrom, envelopeTo }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(parseCloudflareInboundEmail).not.toHaveBeenCalled();
    expect(processNormalizedInboundEmail).not.toHaveBeenCalled();
  });

  it("marks MIME processing failures as retryable failures", async () => {
    vi.mocked(parseCloudflareInboundEmail).mockRejectedValue(new Error("malformed MIME"));
    const response = await POST(signedRequest({ raw, envelopeFrom, envelopeTo }));
    expect(response.status).toBe(500);
    expect(finishInboundEmailEvent).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^cf_/), "failed", "Error");
  });
});

function signedRequest(input: { raw: Uint8Array; signedRaw?: Uint8Array; envelopeFrom: string; envelopeTo: string; timestamp?: string }) {
  const signedRaw = input.signedRaw || input.raw;
  const timestamp = input.timestamp || Math.floor(Date.now() / 1000).toString();
  const rawDigest = digestCloudflareEmail(signedRaw);
  const eventId = createCloudflareEmailEventId({ envelopeFrom: input.envelopeFrom, envelopeTo: input.envelopeTo, rawDigest });
  const signature = signCloudflareEmail({ secret, timestamp, envelopeFrom: input.envelopeFrom, envelopeTo: input.envelopeTo, rawDigest });
  return new Request("http://localhost/api/webhooks/cloudflare-email", {
    method: "POST",
    headers: {
      "content-type": "message/rfc822",
      [CLOUDFLARE_EMAIL_HEADERS.timestamp]: timestamp,
      [CLOUDFLARE_EMAIL_HEADERS.envelopeFrom]: input.envelopeFrom,
      [CLOUDFLARE_EMAIL_HEADERS.envelopeTo]: input.envelopeTo,
      [CLOUDFLARE_EMAIL_HEADERS.eventId]: eventId,
      [CLOUDFLARE_EMAIL_HEADERS.signature]: signature,
    },
    body: Uint8Array.from(input.raw).buffer,
  });
}

function cloneHeadersWithBody(request: Request, body: Uint8Array) {
  return new Request(request.url, { method: "POST", headers: request.headers, body: Uint8Array.from(body).buffer });
}
