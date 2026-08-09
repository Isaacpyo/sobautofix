import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { data, error } = await admin.rpc("apply_enquiry_retention");
  if (error) return NextResponse.json({ error: "Retention task failed" }, { status: 500 });
  return NextResponse.json({ success: true, anonymisedRecords: data });
}
