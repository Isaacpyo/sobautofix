import { NextResponse } from "next/server";
import { getAdminNotificationSummary } from "@/lib/admin/notifications";
import { getAdminUser } from "@/lib/supabase/server";

export async function GET() {
  const admin = await getAdminUser({ requireMfa: false, allowTrustedDevice: true });
  if (!admin || admin.mfaState === "enrollment_required" || admin.mfaState === "challenge_required") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const summary = await getAdminNotificationSummary();
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
