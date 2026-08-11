import { beforeEach, describe, expect, it, vi } from "vitest";
import { getResendWebhookConfig, verifyResendWebhook } from "@/lib/email/resend";
import { beginWebhookEvent, finishWebhookEvent, processDeliveryEvent } from "@/lib/enquiries/thread-repository";
import { POST } from "@/app/api/webhooks/resend/route";

vi.mock("@/lib/email/resend", () => ({
  getResendWebhookConfig: vi.fn(),
  verifyResendWebhook: vi.fn(),
}));

vi.mock("@/lib/enquiries/thread-repository", () => ({
  beginWebhookEvent: vi.fn(),
  finishWebhookEvent: vi.fn(),
  processDeliveryEvent: vi.fn(),
}));

const headers = { "svix-id": "event-1", "svix-timestamp": "123456", "svix-signature": "v1,signature" };

describe("Resend outbound delivery webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResendWebhookConfig).mockReturnValue({ webhookSecret: "secret" } as never);
  });

  it("rejects a missing or invalid signature", async () => {
    expect((await POST(new Request("http://localhost/api/webhooks/resend", { method: "POST", body: "{}" }))).status).toBe(401);
    vi.mocked(verifyResendWebhook).mockImplementation(() => { throw new Error("bad signature"); });
    expect((await POST(new Request("http://localhost/api/webhooks/resend", { method: "POST", headers, body: "{}" }))).status).toBe(401);
    expect(beginWebhookEvent).not.toHaveBeenCalled();
  });

  it("accepts one valid outbound delivery event", async () => {
    const admin = {} as never;
    vi.mocked(verifyResendWebhook).mockReturnValue({ type: "email.delivered", data: { email_id: "outbound-1" } } as never);
    vi.mocked(beginWebhookEvent).mockResolvedValue({ process: true, admin });
    const response = await POST(new Request("http://localhost/api/webhooks/resend", { method: "POST", headers, body: '{"type":"email.delivered"}' }));
    expect(response.status).toBe(200);
    expect(processDeliveryEvent).toHaveBeenCalledWith({ email_id: "outbound-1" }, "email.delivered");
    expect(finishWebhookEvent).toHaveBeenCalledWith(admin, "event-1", "processed");
  });

  it("ignores email.received because inbound transport is Cloudflare", async () => {
    const admin = {} as never;
    vi.mocked(verifyResendWebhook).mockReturnValue({ type: "email.received", data: { email_id: "inbound-1" } } as never);
    vi.mocked(beginWebhookEvent).mockResolvedValue({ process: true, admin });
    const response = await POST(new Request("http://localhost/api/webhooks/resend", { method: "POST", headers, body: "{}" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(processDeliveryEvent).not.toHaveBeenCalled();
    expect(finishWebhookEvent).toHaveBeenCalledWith(admin, "event-1", "ignored");
  });

  it("acknowledges duplicate events without creating another message", async () => {
    vi.mocked(verifyResendWebhook).mockReturnValue({ type: "email.delivered", data: { email_id: "outbound-1" } } as never);
    vi.mocked(beginWebhookEvent).mockResolvedValue({ process: false, admin: {} as never });
    const response = await POST(new Request("http://localhost/api/webhooks/resend", { method: "POST", headers, body: "{}" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(processDeliveryEvent).not.toHaveBeenCalled();
  });
});
