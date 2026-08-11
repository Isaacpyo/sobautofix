import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import { getConfiguredVehicleProvider } from "@/lib/vehicle/configured-provider";
import { VehicleLookupError } from "@/lib/vehicle/provider";
import { registrationSchema } from "@/lib/vehicle/registration";

export async function POST(request: NextRequest) {
  const auth = await getAdminUser();
  const client = createAdminClient();
  if (!auth || !client) return NextResponse.json({ success: false, error: { code: "unauthorised", message: "Your admin session has expired." } }, { status: 401 });
  if (!(await consumeRateLimit(auth.user.id, "admin_vehicle_lookup", 20, 60))) return failure("rate_limited", "Too many lookups. Please wait a minute and try again.", 429);

  const body = await request.json().catch(() => null) as { registration?: unknown } | null;
  const parsed = registrationSchema.safeParse(body?.registration);
  if (!parsed.success) return failure("invalid", "Check the registration number and try again.", 400);

  const provider = getConfiguredVehicleProvider();
  if (!provider) return lookupFailed(client, auth.user.id, "unavailable", "Vehicle lookup is temporarily unavailable. You can try again or enter the vehicle manually.", 503);

  try {
    const vehicle = await provider.lookup(parsed.data);
    const { data: duplicate } = await client.from("sale_vehicles").select("id,make,model,status").eq("registration", parsed.data).maybeSingle();
    await client.from("admin_audit_log").insert({ actor_id: auth.user.id, action: "lookup_completed", entity_type: "sale_vehicle", entity_id: duplicate?.id || "lookup", detail: { duplicate: Boolean(duplicate) } });
    return NextResponse.json({ success: true, vehicle: { ...vehicle, registration: parsed.data }, duplicate: duplicate ? { id: duplicate.id, label: [duplicate.make, duplicate.model].filter(Boolean).join(" "), status: duplicate.status } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof VehicleLookupError ? error : new VehicleLookupError("Vehicle lookup is temporarily unavailable.", "unavailable");
    const message = known.code === "not_found" ? "No vehicle details were found for this registration." : known.code === "invalid" ? "Check the registration number and try again." : known.code === "rate_limited" ? "The lookup service is busy. Please wait and try again." : "Vehicle lookup is temporarily unavailable. You can try again or enter the vehicle manually.";
    const status = known.code === "not_found" ? 404 : known.code === "invalid" ? 400 : known.code === "rate_limited" ? 429 : 503;
    return lookupFailed(client, auth.user.id, known.code, message, status);
  }
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

async function lookupFailed(client: NonNullable<ReturnType<typeof createAdminClient>>, actorId: string, code: string, message: string, status: number) {
  await client.from("admin_audit_log").insert({ actor_id: actorId, action: "lookup_failed", entity_type: "sale_vehicle", entity_id: "lookup", detail: { code } });
  return failure(code, message, status);
}
