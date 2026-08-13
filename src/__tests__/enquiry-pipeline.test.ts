import { beforeEach, describe, expect, it, vi } from "vitest";
import { getResendConfig, sendTransactionalEmail } from "@/lib/email/resend";
import { createEnquiry } from "@/lib/enquiries/repository";
import { createAdminClient } from "@/lib/supabase/server";
import { createInitialEnquiryMessage, getEnquiryReplyAddress } from "@/lib/enquiries/thread-repository";

vi.mock("@/lib/email/resend", () => ({
  getResendConfig: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/enquiries/thread-repository", () => ({
  createInitialEnquiryMessage: vi.fn(),
  getEnquiryReplyAddress: vi.fn(),
}));

describe("enquiry persistence and notification pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a general enquiry before emailing the business and customer", async () => {
    const events: string[] = [];
    const updates: unknown[] = [];
    const adminClient = {
      from(table: string) {
        return {
          insert(payload: unknown) {
            events.push(`${table}:insert`);
            if (table === "customers") return { select: () => ({ single: async () => ({ data: { id: "customer-id" }, error: null }) }) };
            if (table === "enquiries") return { select: () => ({ single: async () => ({ data: { id: "enquiry-id" }, error: null }) }) };
            return Promise.resolve({ data: payload, error: null });
          },
          update(payload: unknown) {
            updates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };

    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
    vi.mocked(createInitialEnquiryMessage).mockResolvedValue(undefined);
    vi.mocked(getEnquiryReplyAddress).mockResolvedValue("enquiry+9f99f1f0-2252-4b5e-9000-9bc913650f15@reply.sobautofix.com");
    vi.mocked(getResendConfig).mockReturnValue({
      apiKey: "test-key",
      from: "SOB Autofix <notifications@sobautofix.com>",
      replyTo: "sobautofix@gmail.com",
      notificationRecipient: "sobautofix@gmail.com",
    });
    vi.mocked(sendTransactionalEmail).mockImplementation(async () => {
      events.push("email:send");
      return { data: { id: "email-id" }, error: null } as never;
    });

    const result = await createEnquiry({
      type: "general",
      contact: { name: "Test Customer", email: "customer@example.com", phone: "07123456789", preferredContact: "email" },
      description: "The vehicle has an intermittent warning light.",
      turnstileToken: "test-token",
    });

    expect(result).toEqual({ id: "enquiry-id", persisted: true, notificationStatus: "sent" });
    expect(events.indexOf("enquiries:insert")).toBeLessThan(events.indexOf("email:send"));
    expect(createInitialEnquiryMessage).toHaveBeenCalledWith("enquiry-id", expect.objectContaining({ description: "The vehicle has an intermittent warning light." }));
    expect(sendTransactionalEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({
      to: "sobautofix@gmail.com",
      replyTo: "customer@example.com",
      subject: "New general enquiry",
      html: expect.stringContaining("NEW ENQUIRY"),
      text: expect.stringContaining("NEW ENQUIRY"),
    }));
    expect(sendTransactionalEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({
      to: "customer@example.com",
      subject: "We received your SOB Autofix request",
      replyTo: "enquiry+9f99f1f0-2252-4b5e-9000-9bc913650f15@reply.sobautofix.com",
      html: expect.stringContaining("REQUEST RECEIVED"),
      text: expect.stringContaining("REQUEST RECEIVED"),
    }));
    expect(updates).toContainEqual({ notification_status: "sent" });
  });
});
