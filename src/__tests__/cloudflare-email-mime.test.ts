import { describe, expect, it } from "vitest";
import { parseCloudflareInboundEmail } from "@/lib/enquiries/inbound-email";

const eventId = `cf_${"a".repeat(64)}`;
const envelope = { eventId, envelopeFrom: "customer@example.com", envelopeTo: "enquiry+9f99f1f0-2252-4b5e-9000-9bc913650f15@reply.sobautofix.com" };
const encode = (value: string) => new TextEncoder().encode(value.replaceAll("\n", "\r\n"));

describe("Cloudflare raw MIME normalization", () => {
  it("parses plain text and threading headers", async () => {
    const email = await parseCloudflareInboundEmail({
      ...envelope,
      raw: encode("From: Customer <customer@example.com>\nTo: SOB Autofix <enquiry+9f99f1f0-2252-4b5e-9000-9bc913650f15@reply.sobautofix.com>\nSubject: Re: repair\nMessage-ID: <reply@example.com>\nIn-Reply-To: <sent@example.com>\nReferences: <old@example.com> <sent@example.com>\nAuto-Submitted: no\n\nThe warning light is still on."),
    });
    expect(email.from).toBe("Customer <customer@example.com>");
    expect(email.messageId).toBe("<reply@example.com>");
    expect(email.inReplyTo).toBe("<sent@example.com>");
    expect(email.references).toEqual(["<old@example.com>", "<sent@example.com>"]);
    expect(email.text).toContain("warning light");
    expect(email.headers["auto-submitted"]).toBe("no");
  });

  it("parses multipart alternatives and safely defers attachments", async () => {
    const email = await parseCloudflareInboundEmail({
      ...envelope,
      raw: encode("From: customer@example.com\nTo: token@reply.sobautofix.com\nSubject: Photos\nMIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=outer\n\n--outer\nContent-Type: multipart/alternative; boundary=inner\n\n--inner\nContent-Type: text/plain; charset=utf-8\n\nPlain reply\n--inner\nContent-Type: text/html; charset=utf-8\n\n<p>HTML reply</p>\n--inner--\n--outer\nContent-Type: image/png\nContent-Disposition: attachment; filename=photo.png\nContent-Transfer-Encoding: base64\n\naGVsbG8=\n--outer--"),
    });
    expect(email.text).toContain("Plain reply");
    expect(email.html).toContain("HTML reply");
    expect(email.attachmentCount).toBe(1);
    expect(email).not.toHaveProperty("attachments");
  });

  it("rejects an empty malformed payload", async () => {
    await expect(parseCloudflareInboundEmail({ ...envelope, raw: new Uint8Array() })).rejects.toThrow("empty");
  });
});
