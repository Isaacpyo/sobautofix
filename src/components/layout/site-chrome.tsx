"use client";

import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { ConsentManager } from "@/components/privacy/consent-manager";
import { Footer } from "./footer";
import { FloatingWhatsApp } from "./floating-whatsapp";
import { Header } from "./header";
import { PublicMotion } from "@/components/marketing/public-motion";
import type { SiteSettings } from "@/config/settings";
import type { PublicNavigationItem } from "@/lib/navigation/repository";

export function SiteChrome({ children, settings, navigation }: { children: React.ReactNode; settings: SiteSettings; navigation: PublicNavigationItem[] }) {
  const pathname = usePathname();
  // On the exchange host the proxy rewrites "/cars" to "/exchange/cars", but
  // usePathname() returns the browser path, so check the route segment too.
  const segment = useSelectedLayoutSegment();
  const isBackOffice = pathname.startsWith("/admin") || pathname.startsWith("/auth");
  if (isBackOffice) return <main>{children}</main>;
  // SOB Auto Exchange renders its own header, footer and mobile navigation.
  if (segment === "exchange" || pathname === "/exchange" || pathname.startsWith("/exchange/")) return <>{children}<ConsentManager /></>;
  return <><Header settings={settings} navigation={navigation} /><main data-public-site>{children}</main><PublicMotion /><Footer settings={settings} /><FloatingWhatsApp /><ConsentManager /></>;
}
