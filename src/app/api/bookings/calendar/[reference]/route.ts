import { NextRequest } from "next/server";
import { buildBookingCalendar, verifyBookingCalendarSignature } from "@/lib/bookings/calendar";
import { getBookingCalendarNotification } from "@/lib/bookings/repository";
import { formatRegistration } from "@/lib/vehicle/registration-format";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const signature = request.nextUrl.searchParams.get("signature");
  if (!/^SOB-[A-Z0-9-]{4,28}$/i.test(reference) || !verifyBookingCalendarSignature(reference, signature)) {
    return new Response("Calendar not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const booking = await getBookingCalendarNotification(reference);
  if (!booking) return new Response("Calendar not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const details = booking.details;
  const calendar = buildBookingCalendar({
    reference: details.reference,
    customerName: details.customerName,
    customerEmail: details.customerEmail,
    service: details.service,
    vehicle: [formatRegistration(details.registration), details.vehicleName].filter(Boolean).join(" · "),
    appointmentStart: details.appointmentStart,
    appointmentEnd: details.appointmentEnd!,
    timezone: details.timezone,
    location: details.location,
    sequence: details.calendarSequence,
    status: booking.type,
    timestamp: details.calendarTimestamp,
  });

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reference.toUpperCase()}.ics"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
