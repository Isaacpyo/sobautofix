import { NextRequest, NextResponse } from "next/server";
import { processCalComWebhook } from "@/lib/bookings/repository";
import { isCalComWebhook, verifyCalComWebhook } from "@/lib/calcom/webhook";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-cal-signature-256");
  if (!verifyCalComWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  let event: unknown;
  try {
    event = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
  if (!isCalComWebhook(event)) {
    return NextResponse.json({ error: "Unsupported webhook payload" }, { status: 400 });
  }
  try {
    const result = await processCalComWebhook(event, rawBody);
    return NextResponse.json({ received: true, duplicate: result.duplicate, outcome: result.outcome });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 503 });
  }
}
