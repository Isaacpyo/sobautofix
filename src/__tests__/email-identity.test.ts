import { describe, expect, it } from "vitest";
import { approvedBookingReplyTo, approvedEnquiryFallbackReplyTo, isValidEmailAddress, productionEmailSender, resolveReplyTo } from "@/lib/email/identity";

describe("transactional email identity", () => {
  it("uses the approved production sender", () => {
    expect(productionEmailSender).toBe("SOB Autofix <notifications@sobautofix.com>");
    expect(approvedBookingReplyTo).toBe("info@sobautofix.com");
    expect(approvedEnquiryFallbackReplyTo).toBe("info@sobautofix.com");
  });

  it("defaults customer replies to the business address", () => {
    expect(resolveReplyTo("sobautofix@gmail.com")).toBe("sobautofix@gmail.com");
  });

  it("allows a validated customer address for internal notifications", () => {
    expect(resolveReplyTo("sobautofix@gmail.com", "customer@example.com")).toBe("customer@example.com");
  });

  it("rejects malformed reply-to values", () => {
    expect(isValidEmailAddress("not-an-email")).toBe(false);
    expect(() => resolveReplyTo("sobautofix@gmail.com", "not-an-email")).toThrow();
  });
});
