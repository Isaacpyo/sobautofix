// Host routing for SOB Auto Exchange.
//
// The customer app lives in src/app/exchange and is served two ways:
// * on its own host (exchange.sobautofix.com, exchange.localhost in dev),
//   where proxy.ts rewrites "/cars" to "/exchange/cars" and links have no
//   prefix; and
// * under "/exchange" on any other host (previews, the main domain before
//   DNS is ready), where links keep the prefix.
// Pure functions only: this module is shared by proxy.ts and the app.

export const EXCHANGE_PATH_PREFIX = "/exchange";
export const EXCHANGE_HOST_HEADER = "x-exchange-host";

export function isExchangeHostname(hostname: string, configuredUrl = process.env.NEXT_PUBLIC_EXCHANGE_URL) {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  if (configuredUrl) {
    try {
      if (new URL(configuredUrl).hostname.toLowerCase() === host) return true;
    } catch {
      // Ignore an invalid configured URL and fall back to the prefix rule.
    }
  }
  return host.startsWith("exchange.");
}

/** Paths on the exchange host that are shared app infrastructure, not exchange pages. */
export function isSharedInfrastructurePath(pathname: string) {
  return pathname.startsWith("/_next/")
    || pathname.startsWith("/api/")
    || pathname === "/favicon.ico"
    || pathname.startsWith("/brand/")
    || pathname.startsWith("/email/")
    || pathname.startsWith("/monitoring");
}

/** Build an in-app href for the exchange. `base` is "" on the exchange host and "/exchange" elsewhere. */
export function exchangeHref(base: string, path = "/") {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  if (!base) return normalised;
  return normalised === "/" ? base : `${base}${normalised}`;
}

/** Strip the "/exchange" prefix, giving the path as it appears on the exchange host. */
export function toExchangePublicPath(pathname: string) {
  if (pathname === EXCHANGE_PATH_PREFIX) return "/";
  return pathname.startsWith(`${EXCHANGE_PATH_PREFIX}/`) ? pathname.slice(EXCHANGE_PATH_PREFIX.length) : pathname;
}
