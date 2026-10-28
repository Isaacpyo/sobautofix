import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { finalisePhoto, PhotoError } from "@/lib/exchange/public/photo-service";
import { clientIp, jsonError } from "@/lib/exchange/public/request";
import { sellerPhotoFinalizeSchema } from "@/lib/exchange/public/schemas";
import { verifySellerUploadToken } from "@/lib/exchange/public/upload-token";
import { consumeRateLimit } from "@/lib/rate-limit";

// sharp needs the Node.js runtime.
export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success || !verifySellerUploadToken(request.headers.get("x-upload-token"), id)) {
    return jsonError(403, "This upload session has expired.", { code: "UPLOAD_SESSION" });
  }
  if (!(await consumeRateLimit(clientIp(request), "exchange_seller_photo_finalize", 60, 600))) return jsonError(429, "Too many uploads at once. Please wait a moment and retry.");
  const parsed = sellerPhotoFinalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid photo.", { code: "INVALID" });

  try {
    await finalisePhoto(id, parsed.data.photoId);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PhotoError) {
      const status = error.code === "REJECTED" ? 422 : error.code === "NOT_FOUND" ? 404 : error.code === "UPLOAD_MISSING" ? 409 : 503;
      return jsonError(status, error.message, { code: error.code });
    }
    return jsonError(503, "Could not save the photo. Please try again.");
  }
}
