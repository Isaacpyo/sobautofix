import { NextRequest, NextResponse } from "next/server";
import { BookingWorkflowError, createBooking } from "@/lib/bookings/repository";
import { createBookingSchema } from "@/lib/bookings/schema";
import { consumeRateLimit } from "@/lib/rate-limit";

function requesterIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = requesterIp(request);
  if (!(await consumeRateLimit(ip, "booking_create_ip", 5, 600))) {
    return NextResponse.json({ error: { code: "rate_limited", message: "Too many booking attempts. Please wait before trying again." } }, { status: 429 });
  }
  const parsed = createBookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "invalid_request", message: "Check the booking details and try again." } }, { status: 400 });
  }
  if (!(await consumeRateLimit(`${ip}:${parsed.data.customer.email}`, "booking_create_details", 5, 1_800))) {
    return NextResponse.json({ error: { code: "rate_limited", message: "Too many booking attempts. Please wait before trying again." } }, { status: 429 });
  }
  try {
    const booking = await createBooking(parsed.data);
    return NextResponse.json({ booking }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingWorkflowError) {
      const status = error.code === "slot_unavailable" || error.code === "processing" ? 409
        : error.code === "service_unavailable" ? 422
          : 503;
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: { code: "provider_unavailable", message: "We couldn't complete this booking. Please try again." } }, { status: 503 });
  }
}

