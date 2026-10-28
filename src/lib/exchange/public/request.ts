import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { formatPrice, vehicleName } from "./format";
import type { ExchangeServiceError } from "./enquiry-service";

export function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  const { code, fields, ...rest } = extra as { code?: string; fields?: unknown };
  return NextResponse.json({ success: false, error: { message, ...(code ? { code } : {}), ...(fields ? { fields } : {}) }, ...rest }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Turn a service failure into a calm public response. Never includes raw database errors. */
export function serviceErrorResponse(error: ExchangeServiceError) {
  switch (error.code) {
    case "VEHICLE_UNAVAILABLE":
      return jsonError(409, error.message, {
        code: "VEHICLE_UNAVAILABLE",
        similar: (error.similar || []).map((vehicle) => ({ slug: vehicle.slug, name: vehicleName(vehicle), price: vehicle.price, priceLabel: formatPrice(vehicle.price) })),
      });
    case "INVALID":
      return jsonError(400, error.message, { code: "INVALID", fields: error.fields });
    case "SCHEMA_MISSING":
    case "NOT_CONFIGURED":
      return jsonError(503, "Online enquiries are temporarily unavailable. Please call or WhatsApp us and we will help straight away.", { code: "UNAVAILABLE" });
    default:
      return jsonError(503, "We could not save your request just now. Please try again, or call us.", { code: "FAILED" });
  }
}
