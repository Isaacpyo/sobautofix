import { NextResponse, type NextRequest } from "next/server";
import { ExchangeServiceError, submitVehicleEnquiry } from "@/lib/exchange/public/enquiry-service";
import { clientIp, jsonError, serviceErrorResponse } from "@/lib/exchange/public/request";
import { vehicleEnquiryRequestSchema } from "@/lib/exchange/public/schemas";
import { consumeRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!(await consumeRateLimit(ip, "exchange_vehicle_enquiry", 6, 600))) {
    return jsonError(429, "Too many requests. Please wait a few minutes before trying again, or call us.");
  }

  const parsed = vehicleEnquiryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted details and try again.", { code: "INVALID", fields: parsed.error.flatten().fieldErrors });
  }
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return jsonError(403, "The security check failed. Please refresh the page and try again.", { code: "TURNSTILE" });
  }

  try {
    const result = await submitVehicleEnquiry(parsed.data);
    return NextResponse.json(
      { success: true, enquiryId: result.enquiryId, requestedStart: result.requestedStart, alternativeStart: result.alternativeStart, notificationStatus: result.notificationStatus },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ExchangeServiceError) return serviceErrorResponse(error);
    return jsonError(503, "We could not save your request just now. Please try again, or call us.", { code: "FAILED" });
  }
}
