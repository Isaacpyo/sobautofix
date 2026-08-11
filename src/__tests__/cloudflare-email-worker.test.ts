import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { digestCloudflareEmail, verifyCloudflareEmailSignature } from "@/lib/enquiries/cloudflare-email-auth";
import { CLOUDFLARE_EMAIL_HEADERS, CLOUDFLARE_EMAIL_MAX_BYTES } from "@/lib/enquiries/cloudflare-email-protocol";
import worker from "../../workers/enquiry-email/src/index";

const secret = "worker-test-secret-that-is-longer-than-thirty-two-characters";
const endpoint = "https://sobautofix.com/api/webhooks/cloudflare-email";

describe("Cloudflare enquiry Email Worker", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))));
  afterEach(() => vi.unstubAllGlobals());

  it("preserves raw MIME and forwards signed envelope metadata", async () => {
    const raw = new TextEncoder().encode("From: customer@example.com\r\nSubject: Reply\r\n\r\nExact bytes");
    const message = emailMessage(raw, "customer@example.com", "enquiry+token@reply.sobautofix.com");
    await worker.email(message, { CLOUDFLARE_EMAIL_WEBHOOK_SECRET: secret, SOB_AUTOFIX_INBOUND_ENDPOINT: endpoint }, {});

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(endpoint);
    expect(new Uint8Array(init.body as Uint8Array)).toEqual(raw);
    const headers = new Headers(init.headers);
    const rawDigest = digestCloudflareEmail(raw);
    expect(headers.get(CLOUDFLARE_EMAIL_HEADERS.eventId)).toMatch(/^cf_[a-f0-9]{64}$/);
    expect(verifyCloudflareEmailSignature({
      secret,
      timestamp: headers.get(CLOUDFLARE_EMAIL_HEADERS.timestamp) || "",
      envelopeFrom: "customer@example.com",
      envelopeTo: "enquiry+token@reply.sobautofix.com",
      rawDigest,
      signature: headers.get(CLOUDFLARE_EMAIL_HEADERS.signature) || "",
    })).toBe(true);
    expect(message.setReject).not.toHaveBeenCalled();
  });

  it("throws on backend failure so Cloudflare can retry safely", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("unavailable", { status: 503 }));
    const raw = new TextEncoder().encode("From: customer@example.com\r\n\r\nRetry me");
    await expect(worker.email(emailMessage(raw, "customer@example.com", "token@reply.sobautofix.com"), {
      CLOUDFLARE_EMAIL_WEBHOOK_SECRET: secret,
      SOB_AUTOFIX_INBOUND_ENDPOINT: endpoint,
    }, {})).rejects.toThrow("status 503");
  });

  it("rejects unrelated recipients and oversized messages without forwarding", async () => {
    const raw = new Uint8Array([1]);
    const wrongDomain = emailMessage(raw, "customer@example.com", "token@sobautofix.com");
    await worker.email(wrongDomain, { CLOUDFLARE_EMAIL_WEBHOOK_SECRET: secret, SOB_AUTOFIX_INBOUND_ENDPOINT: endpoint }, {});
    expect(wrongDomain.setReject).toHaveBeenCalledOnce();

    const oversized = emailMessage(raw, "customer@example.com", "token@reply.sobautofix.com");
    oversized.rawSize = CLOUDFLARE_EMAIL_MAX_BYTES + 1;
    await worker.email(oversized, { CLOUDFLARE_EMAIL_WEBHOOK_SECRET: secret, SOB_AUTOFIX_INBOUND_ENDPOINT: endpoint }, {});
    expect(oversized.setReject).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});

function emailMessage(raw: Uint8Array, from: string, to: string) {
  return {
    from,
    to,
    raw: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(raw); controller.close(); } }),
    rawSize: raw.byteLength,
    setReject: vi.fn(),
  };
}
