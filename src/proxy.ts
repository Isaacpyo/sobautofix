import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { isMandatoryAdminMfaEnabled } from "@/lib/auth/mfa-policy";
import { findValidTrustedDevice, isSensitiveAdminPath, TRUSTED_DEVICE_COOKIE } from "@/lib/auth/trusted-device";
import { EXCHANGE_HOST_HEADER, EXCHANGE_PATH_PREFIX, exchangeRedirectsActive, isExchangeHostname, isSharedInfrastructurePath, toExchangePublicPath } from "@/lib/exchange/host";

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;

  if (isExchangeHostname(hostname)) return routeExchangeHost(request);

  const exchangeRedirect = mainSiteExchangeRedirect(request);
  if (exchangeRedirect) return exchangeRedirect;

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return protectAdmin(request);
  // The exchange header is only ever set by this proxy; drop one sent by a client.
  if (!request.headers.has(EXCHANGE_HOST_HEADER)) return NextResponse.next();
  const sanitized = new Headers(request.headers);
  sanitized.delete(EXCHANGE_HOST_HEADER);
  return NextResponse.next({ request: { headers: sanitized } });
}

function routeExchangeHost(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Staff use the admin on the main site; there is no admin on the exchange host.
  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) {
    const mainSite = process.env.NEXT_PUBLIC_SITE_URL;
    if (mainSite) return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, mainSite));
    return new NextResponse("Not found", { status: 404 });
  }
  if (isSharedInfrastructurePath(pathname)) return NextResponse.next({ request });
  // Keep one URL per page on the exchange host: /exchange/cars -> /cars.
  if (pathname === EXCHANGE_PATH_PREFIX || pathname.startsWith(`${EXCHANGE_PATH_PREFIX}/`)) {
    const target = request.nextUrl.clone();
    target.pathname = toExchangePublicPath(pathname);
    return NextResponse.redirect(target, 308);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(EXCHANGE_HOST_HEADER, "1");
  const rewritten = request.nextUrl.clone();
  rewritten.pathname = pathname === "/" ? EXCHANGE_PATH_PREFIX : `${EXCHANGE_PATH_PREFIX}${pathname}`;
  return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
}

/**
 * Once the exchange host is live in production, send old stock links and
 * the /exchange fallback there permanently. Before that (or on previews)
 * both keep working on the main site.
 */
function mainSiteExchangeRedirect(request: NextRequest) {
  const exchangeUrl = process.env.NEXT_PUBLIC_EXCHANGE_URL;
  if (!exchangeUrl || !exchangeRedirectsActive()) return null;
  const pathname = request.nextUrl.pathname;
  let target: string | null = null;
  if (pathname === EXCHANGE_PATH_PREFIX || pathname.startsWith(`${EXCHANGE_PATH_PREFIX}/`)) target = toExchangePublicPath(pathname);
  else if (pathname === "/cars-for-sale") target = "/cars";
  else if (pathname.startsWith("/cars-for-sale/")) target = `/cars/${pathname.slice("/cars-for-sale/".length)}`;
  if (!target) return null;
  try {
    return NextResponse.redirect(new URL(`${target}${request.nextUrl.search}`, exchangeUrl), 308);
  } catch {
    return null;
  }
}

async function protectAdmin(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
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
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const trustedClient = secretKey ? createSupabaseClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
    if (assurance && requiresMfaChallenge(assurance)) {
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
    if (assurance?.currentLevel === "aal1" && assurance.nextLevel === "aal1" && await isMandatoryAdminMfaEnabled(trustedClient)) {
      const enrollmentUrl = request.nextUrl.clone();
      enrollmentUrl.pathname = "/admin/mfa/enroll";
      enrollmentUrl.search = "";
      const redirectResponse = NextResponse.redirect(enrollmentUrl);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }
  return response;
}

export const config = {
  // Every route except build assets: host routing for the exchange needs to
  // see page, robots and sitemap requests. Admin protection still applies
  // only to /admin and /auth (see proxy()).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
