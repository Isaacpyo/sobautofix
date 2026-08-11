import { NextRequest, NextResponse } from "next/server";
import { SchedulingProviderError } from "@/lib/scheduling/provider";
import { bookingSlotRequestSchema } from "@/lib/bookings/schema";
import { getAvailableSlotsForService } from "@/lib/bookings/services";
import { consumeRateLimit } from "@/lib/rate-limit";

function requesterIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = requesterIp(request);
  if (!(await consumeRateLimit(ip, "booking_slots", 30, 300))) {
    return NextResponse.json({ error: { code: "rate_limited", message: "Too many availability requests. Please wait and try again." } }, { status: 429 });
  }
  const parsed = bookingSlotRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_request", message: "Choose a valid availability window." } }, { status: 400 });
  }
  try {
    const result = await getAvailableSlotsForService(parsed.data);
    if (!result) {
      return NextResponse.json({ error: { code: "service_unavailable", message: "This service is not currently available for online booking." } }, { status: 422 });
    }
    return NextResponse.json({ slots: result.slots, timeZone: result.timeZone }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof SchedulingProviderError && error.code === "rate_limited"
      ? "Appointment availability is busy. Please try again shortly."
      : "Online appointment availability is temporarily unavailable.";
    return NextResponse.json({ error: { code: "provider_unavailable", message } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

