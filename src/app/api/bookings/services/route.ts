import { NextResponse } from "next/server";
import { listPublicBookingServices } from "@/lib/bookings/services";

export async function GET() {
  const services = await listPublicBookingServices();
  return NextResponse.json({ services }, { headers: { "Cache-Control": "no-store" } });
}

