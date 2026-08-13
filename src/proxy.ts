import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { findValidTrustedDevice, isSensitiveAdminPath, TRUSTED_DEVICE_COOKIE } from "@/lib/auth/trusted-device";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const challengeAllowed = pathname === "/admin/mfa" || pathname.startsWith("/admin/mfa/");
  const publicAdminRoute = pathname === "/admin/login" || pathname.startsWith("/admin/forgot-password") || pathname.startsWith("/admin/reset-password");
  if (user && pathname.startsWith("/admin") && !challengeAllowed && !publicAdminRoute) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance && requiresMfaChallenge(assurance)) {
      const secretKey = process.env.SUPABASE_SECRET_KEY;
      const trustedClient = secretKey ? createSupabaseClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
      const trustedDevice = !isSensitiveAdminPath(pathname) && trustedClient
        ? await findValidTrustedDevice(trustedClient, user.id, request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value)
        : null;
      if (trustedDevice) return response;
      const challengeUrl = request.nextUrl.clone();
      challengeUrl.pathname = "/admin/mfa";
      const returnTo = `${pathname}${request.nextUrl.search}`;
      challengeUrl.search = "";
      challengeUrl.searchParams.set("returnTo", returnTo);
      const redirectResponse = NextResponse.redirect(challengeUrl);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*"],
};
