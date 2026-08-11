import { NextResponse } from "next/server";
import { getResendWebhookConfig, verifyResendWebhook } from "@/lib/email/resend";
import { beginWebhookEvent, finishWebhookEvent, processDeliveryEvent } from "@/lib/enquiries/thread-repository";

export async function POST(request: Request) {
  if (!getResendWebhookConfig()) return NextResponse.json({ error: "Resend delivery webhooks are not configured" }, { status: 503 });
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const payload = await request.text();
  let event: ReturnType<typeof verifyResendWebhook>;
  try {
    event = verifyResendWebhook(payload, { id, timestamp, signature });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const data = event.data as unknown as { email_id?: string; message_id?: string };
  const receipt = await beginWebhookEvent(id, event.type, data.email_id);
  if (!receipt.process) return NextResponse.json({ ok: true, duplicate: true });

  try {
    if (["email.sent", "email.delivered", "email.failed", "email.bounced", "email.suppressed"].includes(event.type) && data.email_id) {
      await processDeliveryEvent({ email_id: data.email_id, message_id: data.message_id }, event.type);
      await finishWebhookEvent(receipt.admin, id, "processed");
      return NextResponse.json({ ok: true });
    }
    await finishWebhookEvent(receipt.admin, id, "ignored");
    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    await finishWebhookEvent(receipt.admin, id, "failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
