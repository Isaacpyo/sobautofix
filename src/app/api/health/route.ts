import { NextResponse } from "next/server";
import { getEnvironmentReadiness } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const readiness = getEnvironmentReadiness();
  const admin = createAdminClient();
  const database = admin ? await admin.from("site_settings").select("id").limit(1) : null;
  const databaseReady = Boolean(database && !database.error);
  const ready = readiness.ready && databaseReady;
  const missingIntegrations = readiness.missing.length + (databaseReady ? 0 : 1);

  return NextResponse.json(
    {
      status: ready ? "ready" : "configuration_required",
      checks: { configuration: readiness.ready, database: databaseReady },
      missingIntegrations,
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
