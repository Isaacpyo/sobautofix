import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const calComWebhookTriggers = ["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"] as const;
export type CalComWebhookTrigger = (typeof calComWebhookTriggers)[number];

export type CalComWebhook = {
  triggerEvent: CalComWebhookTrigger;
  createdAt: string;
  payload: {
    uid: string;
    bookingId?: number;
    eventTypeId?: number;
    startTime?: string;
    endTime?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    rescheduleUid?: string;
    rescheduleId?: number;
    rescheduleStartTime?: string;
    rescheduleEndTime?: string;
    cancellationReason?: string;
  };
};

export function verifyCalComWebhook(rawBody: string, suppliedSignature: string | null) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET?.trim();
  if (!secret || !suppliedSignature || !/^[a-f0-9]{64}$/i.test(suppliedSignature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = Buffer.from(suppliedSignature.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}

export function isCalComWebhook(value: unknown): value is CalComWebhook {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CalComWebhook>;
  return Boolean(
    event.triggerEvent
      && calComWebhookTriggers.includes(event.triggerEvent)
      && typeof event.createdAt === "string"
      && event.payload
      && typeof event.payload.uid === "string",
  );
}

