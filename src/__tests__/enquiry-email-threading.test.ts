import { describe, expect, it } from "vitest";
import {
  buildEnquiryReplyAddress,
  conversationSubject,
  extractMessageIds,
  extractReplyToken,
  headerValue,
  isAutomatedEmail,
  parseSenderEmail,
  resolveInboundThread,
  safeInboundText,
} from "@/lib/enquiries/email-threading";

const token = "9f99f1f0-2252-4b5e-9000-9bc913650f15";

describe("enquiry email threading", () => {
  it("builds and resolves an opaque reply token only on the inbound domain", () => {
    const address = buildEnquiryReplyAddress(token, "Reply.SobAutofix.com");
    expect(address).toBe(`enquiry+${token}@reply.sobautofix.com`);
    expect(extractReplyToken([address], "reply.sobautofix.com")).toBe(token);
    expect(extractReplyToken([address.toUpperCase()], "reply.sobautofix.com")).toBe(token);
    expect(extractReplyToken([`enquiry+${token}@example.com`], "reply.sobautofix.com")).toBeNull();
  });

  it("rejects malformed or non-enquiry reply recipients", () => {
    expect(extractReplyToken(["enquiry@reply.sobautofix.com"], "reply.sobautofix.com")).toBeNull();
    expect(extractReplyToken(["enquiry+@reply.sobautofix.com"], "reply.sobautofix.com")).toBeNull();
    expect(extractReplyToken(["enquiry+malformed-token@reply.sobautofix.com"], "reply.sobautofix.com")).toBeNull();
    expect(extractReplyToken([`random+${token}@reply.sobautofix.com`], "reply.sobautofix.com")).toBeNull();
    expect(extractReplyToken([`enquiry+${token}@sobautofix.com`], "reply.sobautofix.com")).toBeNull();
  });

  it("extracts bounded unique message IDs for References headers", () => {
    expect(extractMessageIds("<first@example.com> <second@example.com> <first@example.com>")).toEqual(["<first@example.com>", "<second@example.com>"]);
  });

  it("reads headers case-insensitively and parses a named sender", () => {
    expect(headerValue({ "In-Reply-To": " <thread@example.com> " }, "in-reply-to")).toBe("<thread@example.com>");
    expect(parseSenderEmail("Customer Name <Customer@Example.com>")).toBe("customer@example.com");
  });

  it("converts hostile HTML to safe plain text", () => {
    const result = safeInboundText(null, "<p>Hello</p><script>alert('bad')</script><p><b>World</b></p>");
    expect(result).toBe("Hello\nWorld");
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
  });

  it("detects automated and bounce messages without treating normal mail as automated", () => {
    expect(isAutomatedEmail({ "Auto-Submitted": "auto-replied" }, "customer@example.com", "Reply")).toBe(true);
    expect(isAutomatedEmail({}, "mailer-daemon@example.com", "Delivery report")).toBe(true);
    expect(isAutomatedEmail({}, "customer@example.com", "Re: Your SOB Autofix repair enquiry")).toBe(false);
  });

  it("keeps a stable, non-sensitive conversation subject", () => {
    expect(conversationSubject("mobile_mechanic")).toBe("Re: Your SOB Autofix mobile mechanic enquiry");
  });

  it("matches only by token, In-Reply-To, then References in that order", async () => {
    const calls: string[] = [];
    const result = await resolveInboundThread({
      recipients: [`enquiry+${token}@reply.sobautofix.com`],
      inboundDomain: "reply.sobautofix.com",
      inReplyTo: "<outbound@example.com>",
      references: ["<older@example.com>"],
      findByToken: async () => { calls.push("token"); return "enquiry-token"; },
      findByMessageIds: async () => { calls.push("headers"); return "enquiry-header"; },
    });
    expect(result).toEqual({ enquiryId: "enquiry-token", reason: "reply_token" });
    expect(calls).toEqual(["token"]);
  });

  it("falls back from In-Reply-To to References without any sender-email matcher", async () => {
    const searched: string[][] = [];
    const result = await resolveInboundThread({
      recipients: ["unknown@reply.sobautofix.com"],
      inboundDomain: "reply.sobautofix.com",
      inReplyTo: "<missing@example.com>",
      references: ["<known@example.com>"],
      findByToken: async () => null,
      findByMessageIds: async (ids) => {
        searched.push(ids);
        return ids.includes("<known@example.com>") ? "enquiry-reference" : null;
      },
    });
    expect(result).toEqual({ enquiryId: "enquiry-reference", reason: "references" });
    expect(searched).toEqual([["<missing@example.com>"], ["<known@example.com>"]]);
  });

  it("leaves an unknown token without trusted thread headers unmatched", async () => {
    const result = await resolveInboundThread({
      recipients: ["enquiry+00000000-0000-4000-8000-000000000000@reply.sobautofix.com"],
      inboundDomain: "reply.sobautofix.com",
      inReplyTo: null,
      references: [],
      findByToken: async () => null,
      findByMessageIds: async () => { throw new Error("header lookup should not run"); },
    });
    expect(result).toBeNull();
  });
});
