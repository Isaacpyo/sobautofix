import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";

const recoveryDestination = "/admin/reset-password";

function invalidLink() {
  const destination = new URL("/admin/login", siteConfig.siteUrl);
  destination.searchParams.set("error", "invalid-link");
  return NextResponse.redirect(destination);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#39;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function recoveryConfirmation(tokenHash: string) {
  const token = escapeHtml(tokenHash);
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Continue password recovery | SOB Autofix</title></head>
<body style="margin:0;background:#F4F7FA;color:#071127;font-family:Arial,Helvetica,sans-serif"><main style="box-sizing:border-box;max-width:560px;margin:64px auto;padding:40px;border:1px solid #DCE6F2;border-radius:16px;background:#fff"><p style="color:#1974E2;font-size:12px;font-weight:700;letter-spacing:.7px">PASSWORD RECOVERY</p><h1 style="font-size:30px;line-height:1.25">Continue to reset your password</h1><p style="color:#586575;line-height:1.6">For your security, the recovery link is used only after you confirm below.</p><form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${token}"><input type="hidden" name="type" value="recovery"><input type="hidden" name="next" value="${recoveryDestination}"><button type="submit" style="width:100%;min-height:48px;margin-top:18px;border:0;border-radius:11px;background:#1974E2;color:#fff;font-size:16px;font-weight:700;cursor:pointer">Continue securely</button></form><p style="margin-top:20px;color:#586575;font-size:13px;line-height:1.5">If you did not request this password reset, close this page.</p></main></body></html>`, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      // A basic form POST needs an Origin header for the same-origin check below.
      // strict-origin preserves that header without forwarding the token-bearing URL.
      "Referrer-Policy": "strict-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  if (tokenHash && type === "recovery" && requestedNext === recoveryDestination) return recoveryConfirmation(tokenHash);

  const destination = new URL(requestedNext === recoveryDestination ? recoveryDestination : "/admin", siteConfig.siteUrl);
  const client = await createClient();
  if (code) {
    const { error } = await client?.auth.exchangeCodeForSession(code) ?? { error: new Error("Not configured") };
    if (!error) return NextResponse.redirect(destination);
  }
  if (tokenHash && type && type !== "recovery") {
    const { error } = await client?.auth.verifyOtp({ type, token_hash: tokenHash }) ?? { error: new Error("Not configured") };
    if (!error) return NextResponse.redirect(destination);
  }
  return invalidLink();
}

export async function POST(request: NextRequest) {
  const canonicalOrigin = new URL(siteConfig.siteUrl).origin;
  if (request.headers.get("origin") !== canonicalOrigin) return invalidLink();
  const formData = await request.formData();
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");
  const requestedNext = formData.get("next");
  if (typeof tokenHash !== "string" || !tokenHash || type !== "recovery" || requestedNext !== recoveryDestination) return invalidLink();

  const client = await createClient();
  const { error } = await client?.auth.verifyOtp({ type: "recovery", token_hash: tokenHash }) ?? { error: new Error("Not configured") };
  if (error) return invalidLink();
  return NextResponse.redirect(new URL(recoveryDestination, siteConfig.siteUrl));
}
