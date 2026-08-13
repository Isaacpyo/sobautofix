import "server-only";

import { formatPhone, siteConfig } from "@/config/site";

export const emailBrand = {
  name: siteConfig.name,
  legalName: siteConfig.legalName,
  tagline: siteConfig.tagline,
  supportingLine: siteConfig.supportingLine,
  phone: formatPhone(siteConfig.phone),
  email: siteConfig.email,
  website: "sobautofix.com",
  baseUrl: "https://sobautofix.com",
  logoUrl: "https://sobautofix.com/email/sob-autofix-logo-white.png",
  address: [
    siteConfig.address.building,
    siteConfig.address.street,
    siteConfig.address.town,
    siteConfig.address.city,
    siteConfig.address.postcode,
  ].join(", "),
} as const;

export function emailUrl(path: string) {
  return new URL(path, emailBrand.baseUrl).toString();
}
