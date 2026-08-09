import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const destination = new URL("/admin", request.url);
  if (tokenHash && type) {
    const client = await createClient();
    const { error } = await client?.auth.verifyOtp({ type, token_hash: tokenHash }) ?? { error: new Error("Not configured") };
    if (!error) return NextResponse.redirect(destination);
  }
  destination.pathname = "/admin/login";
  destination.searchParams.set("error", "invalid-link");
  return NextResponse.redirect(destination);
}
