import { NextResponse } from "next/server";
import { documentDownloadUrl } from "@/lib/exchange/admin/documents";
import { getStaffForRoute } from "@/lib/exchange/staff";

const noStore = { "Cache-Control": "private, no-store" };

/** Redirects to a 60-second signed link for a private vehicle document. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404, headers: noStore });
  const { staff, status } = await getStaffForRoute("exchange.view");
  if (!staff) return new NextResponse(status === 401 ? "Sign in again." : "Forbidden", { status, headers: noStore });
  const result = await documentDownloadUrl(staff, id);
  if (result.status !== 200) return new NextResponse(result.status === 403 ? "Forbidden" : result.status === 404 ? "Not found" : "The document could not be opened.", { status: result.status, headers: noStore });
  return NextResponse.redirect(result.url, { status: 303, headers: noStore });
}
