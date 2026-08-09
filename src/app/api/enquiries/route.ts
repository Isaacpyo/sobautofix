import { NextRequest, NextResponse } from "next/server";
import { createEnquiry } from "@/lib/enquiries/repository";
import { enquiryRequestSchema } from "@/lib/enquiries/schema";
import { createUploadToken } from "@/lib/enquiries/upload-token";
import { consumeRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeRateLimit(ip, "enquiry", 5, 600))) return NextResponse.json({ success: false, error: { message: "Too many requests. Please wait before trying again." } }, { status: 429 });

  const parsed = enquiryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: { message: "Check the form and try again.", fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) return NextResponse.json({ success: false, error: { message: "Security verification failed. Please refresh and try again." } }, { status: 403 });

  try {
    const enquiry = await createEnquiry(parsed.data);
    return NextResponse.json({ success: true, id: enquiry.id, uploadToken: createUploadToken(enquiry.id), notificationStatus: enquiry.notificationStatus }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: { message: "We couldn't save your request. Please call or try again shortly." } }, { status: 503 });
  }
}
