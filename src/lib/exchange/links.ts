import "server-only";

import { headers } from "next/headers";
import { exchangeBaseUrl } from "@/config/exchange";
import { EXCHANGE_HOST_HEADER, EXCHANGE_PATH_PREFIX, exchangeHref } from "@/lib/exchange/host";

/** "" when the request arrived on the exchange host, otherwise "/exchange". */
export async function getExchangeBase() {
  const requestHeaders = await headers();
  return requestHeaders.get(EXCHANGE_HOST_HEADER) === "1" ? "" : EXCHANGE_PATH_PREFIX;
}

/** Whether search engines may index this response: only on the real exchange host in production. */
export async function isExchangeIndexable() {
  const requestHeaders = await headers();
  return requestHeaders.get(EXCHANGE_HOST_HEADER) === "1" && process.env.VERCEL_ENV === "production";
}

/** Absolute canonical URL on the exchange host for a path such as "/cars/ford-focus". */
export function exchangeCanonical(path = "/") {
  const publicPath = exchangeHref("", path);
  return publicPath === "/" ? exchangeBaseUrl() : `${exchangeBaseUrl()}${publicPath}`;
}
