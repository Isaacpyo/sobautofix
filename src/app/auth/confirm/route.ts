import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const recovery = type === "recovery" || requestedNext === "/admin/reset-password";
  const destination = new URL(recovery ? "/admin/reset-password" : "/admin", request.url);
  const client = await createClient();
  if (code) {
    const { error } = await client?.auth.exchangeCodeForSession(code) ?? { error: new Error("Not configured") };
    if (!error) return NextResponse.redirect(destination);
  }
  if (tokenHash && type) {
    const { error } = await client?.auth.verifyOtp({ type, token_hash: tokenHash }) ?? { error: new Error("Not configured") };
    if (!error) return NextResponse.redirect(destination);
  }
  destination.pathname = "/admin/login";
  destination.searchParams.set("error", "invalid-link");
  return NextResponse.redirect(destination);
}
