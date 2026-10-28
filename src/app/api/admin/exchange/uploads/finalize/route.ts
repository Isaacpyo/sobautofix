import { NextResponse } from "next/server";
import { ExchangeUserError, revalidateExchangeAdmin, revalidatePublicStock } from "@/lib/exchange/admin/core";
import { finalizeRequestSchema, finalizeUpload, uploadPermission } from "@/lib/exchange/admin/documents";
import { getStaffForRoute } from "@/lib/exchange/staff";

const noStore = { "Cache-Control": "no-store" };

/** Checks the uploaded bytes (magic number, size), re-encodes photos, then records the file. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = finalizeRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the file and try again." }, { status: 400, headers: noStore });
  const { staff, status } = await getStaffForRoute(uploadPermission(parsed.data));
  if (!staff) return NextResponse.json({ error: status === 401 ? "Your admin session has expired. Sign in again." : "You do not have permission to upload here." }, { status, headers: noStore });
  try {
    const result = await finalizeUpload(staff, parsed.data);
    revalidateExchangeAdmin();
    if (parsed.data.target === "stock_photo") revalidatePublicStock("slug" in result ? (result.slug as string | undefined) : undefined);
    return NextResponse.json({ id: result.id }, { headers: noStore });
  } catch (error) {
    const message = error instanceof ExchangeUserError ? error.message : "The file could not be saved. Try again.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
}
