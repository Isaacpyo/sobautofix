import { NextResponse, type NextRequest } from "next/server";
import { ExchangeServiceError } from "@/lib/exchange/public/enquiry-service";
import { clientIp, jsonError, serviceErrorResponse } from "@/lib/exchange/public/request";
import { sellerSubmissionRequestSchema } from "@/lib/exchange/public/schemas";
import { submitSellerSubmission } from "@/lib/exchange/public/seller-service";
import { createSellerUploadToken } from "@/lib/exchange/public/upload-token";
import { consumeRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!(await consumeRateLimit(ip, "exchange_seller_submission", 5, 900))) {
    return jsonError(429, "Too many requests. Please wait a few minutes before trying again, or call us.");
  }

  const parsed = sellerSubmissionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Nested field errors keyed by step, e.g. { vehicle: { mileage: [...] } }.
    const tree = parsed.error.issues.reduce<Record<string, string[]>>((fields, issue) => {
      const path = issue.path.join(".");
      (fields[path] ||= []).push(issue.message);
      return fields;
    }, {});
    return jsonError(400, "Please check the highlighted details and try again.", { code: "INVALID", fields: tree });
  }
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return jsonError(403, "The security check failed. Please refresh the page and try again.", { code: "TURNSTILE" });
  }

  try {
    const result = await submitSellerSubmission(parsed.data);
    return NextResponse.json(
      { success: true, submissionId: result.submissionId, reference: result.reference, kind: result.kind, uploadToken: createSellerUploadToken(result.submissionId), notificationStatus: result.notificationStatus },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ExchangeServiceError) return serviceErrorResponse(error);
    return jsonError(503, "We could not save your enquiry just now. Please try again, or call us.", { code: "FAILED" });
  }
}
