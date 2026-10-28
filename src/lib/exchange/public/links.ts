// Links between SOB Auto Exchange and the main SOB Autofix site, and contact
// hrefs built from settings. Pure: safe in server and client components.

import { EXCHANGE_PATH_PREFIX } from "@/lib/exchange/host";

const DEFAULT_MAIN_SITE = "https://sobautofix.com";

export function mainSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_MAIN_SITE;
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_MAIN_SITE;
  }
}

/**
 * A link to a page on the main workshop site. Under the "/exchange" fallback
 * we are already on the main site, so the link stays relative; on the
 * exchange host it must be absolute.
 */
export function mainSiteHref(base: string, path = "/") {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return base === EXCHANGE_PATH_PREFIX ? normalised : `${mainSiteOrigin()}${normalised}`;
}

/** "07469 273483" -> "tel:+447469273483". Empty when there is no number. */
export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("44")) return `tel:+${digits}`;
  return `tel:+44${digits.replace(/^0/, "")}`;
}

export function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.startsWith("44") ? digits : `44${digits.replace(/^0/, "")}`}`;
}

export function formatUkPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("0") ? `${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
}

export function mapsHref(address: string, configured?: string) {
  if (configured) return configured;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
