import { NextResponse } from "next/server";
import { submissionPhotoUrl } from "@/lib/exchange/admin/documents";
import { getStaffForRoute } from "@/lib/exchange/staff";

const noStore = { "Cache-Control": "private, no-store" };

/** Redirects to a 60-second signed link for a seller's private photo. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404, headers: noStore });
  const { staff, status } = await getStaffForRoute("buying.manage");
  if (!staff) return new NextResponse(status === 401 ? "Sign in again." : "Forbidden", { status, headers: noStore });
  const result = await submissionPhotoUrl(staff, id);
  if (result.status !== 200) return new NextResponse(result.status === 404 ? "Not found" : result.status === 409 ? "Upload not completed" : "The photo could not be opened.", { status: result.status, headers: noStore });
  return NextResponse.redirect(result.url, { status: 303, headers: noStore });
}
