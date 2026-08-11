import { afterEach, describe, expect, it } from "vitest";
import { getCloudflareInboundConfig, getEnquiryReplyDomain } from "@/lib/enquiries/inbound-config";

const originalDomain = process.env.ENQUIRY_REPLY_DOMAIN;
const originalFallback = process.env.RESEND_INBOUND_DOMAIN;
const originalSecret = process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;

describe("provider-neutral inbound email configuration", () => {
  afterEach(() => {
    restore("ENQUIRY_REPLY_DOMAIN", originalDomain);
    restore("RESEND_INBOUND_DOMAIN", originalFallback);
    restore("CLOUDFLARE_EMAIL_WEBHOOK_SECRET", originalSecret);
  });

  it("prefers the canonical enquiry reply domain", () => {
    process.env.ENQUIRY_REPLY_DOMAIN = "Reply.SobAutofix.com";
    process.env.RESEND_INBOUND_DOMAIN = "legacy.example.com";
    expect(getEnquiryReplyDomain()).toBe("reply.sobautofix.com");
  });

  it("supports the legacy domain only as a rollout fallback", () => {
    delete process.env.ENQUIRY_REPLY_DOMAIN;
    process.env.RESEND_INBOUND_DOMAIN = "reply.sobautofix.com";
    expect(getEnquiryReplyDomain()).toBe("reply.sobautofix.com");
  });

  it("requires a valid domain and high-entropy-length server secret", () => {
    process.env.ENQUIRY_REPLY_DOMAIN = "reply.sobautofix.com";
    process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET = "short";
    expect(getCloudflareInboundConfig()).toBeNull();
    process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET = "x".repeat(32);
    expect(getCloudflareInboundConfig()).toEqual({ replyDomain: "reply.sobautofix.com", webhookSecret: "x".repeat(32) });
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
