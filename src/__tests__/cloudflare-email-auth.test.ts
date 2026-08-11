import { describe, expect, it } from "vitest";
import {
  createCloudflareEmailEventId,
  digestCloudflareEmail,
  isFreshCloudflareEmailTimestamp,
  signCloudflareEmail,
  verifyCloudflareEmailSignature,
} from "@/lib/enquiries/cloudflare-email-auth";

const secret = "test-secret-that-is-longer-than-thirty-two-characters";
const raw = new TextEncoder().encode("From: customer@example.com\r\n\r\nHello");
const timestamp = "1786446000";

describe("Cloudflare email request authentication", () => {
  it("accepts a valid signature and creates a deterministic non-sensitive event ID", () => {
    const rawDigest = digestCloudflareEmail(raw);
    const input = { secret, timestamp, envelopeFrom: "Customer@Example.com", envelopeTo: "enquiry+token@reply.sobautofix.com", rawDigest };
    const signature = signCloudflareEmail(input);
    expect(verifyCloudflareEmailSignature({ ...input, signature })).toBe(true);
    expect(createCloudflareEmailEventId(input)).toMatch(/^cf_[a-f0-9]{64}$/);
    expect(createCloudflareEmailEventId(input)).toBe(createCloudflareEmailEventId(input));
  });

  it("rejects bad signatures and any modified signed field", () => {
    const rawDigest = digestCloudflareEmail(raw);
    const input = { secret, timestamp, envelopeFrom: "customer@example.com", envelopeTo: "enquiry+token@reply.sobautofix.com", rawDigest };
    const signature = signCloudflareEmail(input);
    expect(verifyCloudflareEmailSignature({ ...input, signature: `v1=${"0".repeat(64)}` })).toBe(false);
    expect(verifyCloudflareEmailSignature({ ...input, envelopeTo: "attacker@example.com", signature })).toBe(false);
    expect(verifyCloudflareEmailSignature({ ...input, rawDigest: digestCloudflareEmail(new TextEncoder().encode("changed")), signature })).toBe(false);
  });

  it("enforces the five-minute timestamp window", () => {
    expect(isFreshCloudflareEmailTimestamp("1786446000", 1786446000 + 300)).toBe(true);
    expect(isFreshCloudflareEmailTimestamp("1786446000", 1786446000 + 301)).toBe(false);
    expect(isFreshCloudflareEmailTimestamp("not-a-time", 1786446000)).toBe(false);
  });
});
