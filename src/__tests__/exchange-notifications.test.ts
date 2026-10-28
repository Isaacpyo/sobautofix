import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionalEmailDeliveryError } from "@/lib/email/resend";

const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
const updates: Array<{ table: string; row: Record<string, unknown> }> = [];
const send = vi.fn();
let configured = true;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; },
      update: (row: Record<string, unknown>) => ({ eq: async () => { updates.push({ table, row }); return { error: null }; } }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { notification_attempt_count: 0 }, error: null }) }) }),
    }),
  }),
}));
vi.mock("@/lib/email/resend", async (original) => ({
  ...(await original<typeof import("@/lib/email/resend")>()),
  getResendConfig: () => (configured ? { replyTo: "info@sobautofix.com" } : null),
  sendTransactionalEmail: (...args: unknown[]) => send(...args),
}));
vi.mock("@/lib/enquiries/thread-repository", () => ({ getEnquiryReplyAddress: async () => null }));
vi.mock("@/lib/exchange/settings", () => ({ getExchangeNotificationRecipients: async () => ["sales@example.test"] }));

const message = { subject: "Viewing request", email: { html: "<p>x</p>", text: "x" } };

describe("exchange notifications", () => {
  beforeEach(() => {
    inserts.length = 0;
    updates.length = 0;
    send.mockReset();
    configured = true;
  });

  it("retries a transient failure once inline and records success", async () => {
    const { sendExchangeNotifications } = await import("@/lib/exchange/public/notifications");
    send.mockRejectedValueOnce(new TransactionalEmailDeliveryError("ambiguous", "internal_server_error", true)).mockResolvedValue({ data: { id: "msg-1" } });
    const status = await sendExchangeNotifications({ enquiryId: "e1", enquiryType: "vehicle_sales", staff: message });
    expect(status).toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
    expect(inserts).toEqual([{ table: "notification_attempts", row: expect.objectContaining({ recipient_type: "business", status: "sent", provider_id: "msg-1" }) }]);
    expect(updates.at(-1)?.row).toMatchObject({ notification_status: "sent", notification_attempt_count: 1, notification_next_retry_at: null });
  });

  it("does not retry a rejection, and schedules the retry sweep in 15 minutes", async () => {
    const { sendExchangeNotifications } = await import("@/lib/exchange/public/notifications");
    send.mockRejectedValue(new TransactionalEmailDeliveryError("rejected", "validation_error", false));
    const before = Date.now();
    const status = await sendExchangeNotifications({ enquiryId: "e2", enquiryType: "vehicle_sales", staff: message, customer: { ...message, to: "buyer@example.test" } });
    expect(status).toBe("failed");
    expect(send).toHaveBeenCalledTimes(2); // one staff, one customer; neither retried
    expect(inserts.map((entry) => `${entry.row.recipient_type}:${entry.row.status}:${entry.row.error_code}`)).toEqual(["business:failed:validation_error", "customer:failed:validation_error"]);
    const outcome = updates.at(-1)?.row as { notification_status: string; notification_attempt_count: number; notification_next_retry_at: string };
    expect(outcome.notification_status).toBe("failed");
    expect(outcome.notification_attempt_count).toBe(1);
    const retryAt = new Date(outcome.notification_next_retry_at).getTime();
    expect(retryAt - before).toBeGreaterThanOrEqual(15 * 60_000 - 1000);
    expect(retryAt - before).toBeLessThanOrEqual(15 * 60_000 + 5000);
  });

  it("marks the enquiry failed when email is not configured, without sending", async () => {
    configured = false;
    const { sendExchangeNotifications } = await import("@/lib/exchange/public/notifications");
    expect(await sendExchangeNotifications({ enquiryId: "e3", enquiryType: "vehicle_purchase", staff: message })).toBe("failed");
    expect(send).not.toHaveBeenCalled();
    expect(inserts[0]?.row).toMatchObject({ status: "failed", error_code: "email_not_configured" });
  });
});
