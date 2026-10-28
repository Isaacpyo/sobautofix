import { NextResponse } from "next/server";
import { z } from "zod";
import { ExchangeUserError } from "@/lib/exchange/admin/core";
import { signRequestSchema, signUpload, uploadPermission } from "@/lib/exchange/admin/documents";
import { getStaffForRoute } from "@/lib/exchange/staff";

const noStore = { "Cache-Control": "no-store" };

/**
 * Issues a short-lived signed upload URL so large files go straight to
 * private storage instead of through the app server. Nothing is recorded
 * until /finalize checks the file.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the file and try again." }, { status: 400, headers: noStore });
  const { staff, status } = await getStaffForRoute(uploadPermission(parsed.data));
  if (!staff) return NextResponse.json({ error: status === 401 ? "Your admin session has expired. Sign in again." : "You do not have permission to upload here." }, { status, headers: noStore });
  try {
    const signed = await signUpload(staff, parsed.data);
    return NextResponse.json(signed, { headers: noStore });
  } catch (error) {
    const message = error instanceof ExchangeUserError || error instanceof z.ZodError ? (error instanceof z.ZodError ? "Check the file and try again." : error.message) : "The upload could not be prepared. Try again.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
}
