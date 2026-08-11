import { NextResponse } from "next/server";
import { getBookingEnvironmentReadiness, getEnvironmentReadiness } from "@/lib/env";
import { getBookingServiceReadiness } from "@/lib/bookings/services";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const readiness = getEnvironmentReadiness();
  const bookingEnvironment = getBookingEnvironmentReadiness();
  const admin = createAdminClient();
  const [database, bookingServices] = await Promise.all([
    admin ? admin.from("site_settings").select("id").limit(1) : null,
    getBookingServiceReadiness(),
  ]);
  const databaseReady = Boolean(database && !database.error);
  const ready = readiness.ready && databaseReady;
  const bookingAvailabilityReady = Boolean(
    process.env.CALCOM_API_KEY
      && process.env.CALCOM_DEFAULT_TIMEZONE
      && bookingServices.configured,
  );
  const missingIntegrations = readiness.missing.length + bookingEnvironment.missing.length + (databaseReady ? 0 : 1) + (bookingServices.mappedServices ? 0 : 1);

  return NextResponse.json(
    {
      status: ready ? "ready" : "configuration_required",
      checks: {
        website: ready ? "online" : "configuration_required",
        configuration: readiness.ready,
        database: databaseReady ? "connected" : "degraded",
        email: readiness.ready ? "operational" : "configuration_required",
        bookingAvailability: bookingAvailabilityReady ? "operational" : "degraded",
        bookingManagement: Boolean(process.env.BOOKING_MANAGEMENT_SECRET) ? "configured" : "configuration_required",
        bookingWebhook: Boolean(process.env.CALCOM_WEBHOOK_SECRET) ? "configured" : "configuration_required",
        bookingServiceMappings: bookingServices.mappedServices,
      },
      missingIntegrations,
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
