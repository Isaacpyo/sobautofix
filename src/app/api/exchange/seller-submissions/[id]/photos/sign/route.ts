import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PhotoError, signPhotoUpload } from "@/lib/exchange/public/photo-service";
import { clientIp, jsonError } from "@/lib/exchange/public/request";
import { sellerPhotoSignSchema } from "@/lib/exchange/public/schemas";
import { verifySellerUploadToken } from "@/lib/exchange/public/upload-token";
import { consumeRateLimit } from "@/lib/rate-limit";

const bodySchema = sellerPhotoSignSchema.extend({ photoId: z.uuid().optional() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success || !verifySellerUploadToken(request.headers.get("x-upload-token"), id)) {
    return jsonError(403, "This upload session has expired. Your enquiry is saved; please call us to send photos another way.", { code: "UPLOAD_SESSION" });
  }
  if (!(await consumeRateLimit(clientIp(request), "exchange_seller_photo", 60, 600))) return jsonError(429, "Too many uploads at once. Please wait a moment and retry.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Photos must be JPG, PNG or WebP images up to 8 MB.", { code: "INVALID" });

  try {
    const signed = await signPhotoUpload(id, parsed.data);
    return NextResponse.json({ success: true, ...signed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PhotoError) return jsonError(error.code === "LIMIT" ? 400 : error.code === "NOT_FOUND" ? 404 : 503, error.message, { code: error.code });
    return jsonError(503, "Photo uploads are temporarily unavailable.");
  }
}
