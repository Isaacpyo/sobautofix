import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getConfiguredVehicleProvider } from "@/lib/vehicle/configured-provider";
import { VehicleLookupError } from "@/lib/vehicle/provider";
import { registrationSchema } from "@/lib/vehicle/registration";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeRateLimit(ip, "vehicle_lookup", 10, 60))) {
    return NextResponse.json({ success: false, error: { code: "rate_limited", message: "Too many lookups. Please wait a minute and try again." } }, { status: 429 });
  }

  const body = await request.json().catch(() => null) as { registration?: unknown } | null;
  const parsed = registrationSchema.safeParse(body?.registration);
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: "invalid", message: "Enter a valid UK registration." } }, { status: 400 });

  const provider = getConfiguredVehicleProvider();
  if (!provider) return NextResponse.json({ success: false, error: { code: "unavailable", message: "Vehicle lookup is not configured. You can continue manually." } }, { status: 503 });

  try {
    const vehicle = await provider.lookup(parsed.data);
    return NextResponse.json({ success: true, vehicle }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof VehicleLookupError ? error : new VehicleLookupError("Vehicle lookup is unavailable", "unavailable");
    const status = known.code === "not_found" ? 404 : known.code === "invalid" ? 400 : known.code === "rate_limited" ? 429 : 503;
    return NextResponse.json({ success: false, error: { code: known.code, message: known.code === "not_found" ? "We couldn't identify that vehicle. You can continue manually." : known.message } }, { status });
  }
}
