import { NextResponse } from "next/server";
import { getEnvironmentReadiness } from "@/lib/env";

export function GET() {
  const readiness = getEnvironmentReadiness();
  return NextResponse.json({ status: readiness.ready ? "ready" : "configuration_required", missingIntegrations: readiness.missing.length }, { status: readiness.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
