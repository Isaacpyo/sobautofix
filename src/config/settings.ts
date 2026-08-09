import { siteConfig } from "./site";

export type SiteSettings = typeof siteConfig;

export function linksForSettings(settings: SiteSettings) {
  return {
    phone: `tel:+44${settings.phone.slice(1)}`,
    whatsapp: `https://wa.me/44${settings.whatsapp.slice(1)}`,
    email: `mailto:${settings.email}`,
  };
}
