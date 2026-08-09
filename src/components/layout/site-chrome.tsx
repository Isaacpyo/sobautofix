"use client";

import { usePathname } from "next/navigation";
import { ConsentManager } from "@/components/privacy/consent-manager";
import { Footer } from "./footer";
import { Header } from "./header";
import { StickyMobileCta } from "./sticky-mobile-cta";
import type { SiteSettings } from "@/config/settings";
import type { PublicNavigationItem } from "@/lib/navigation/repository";

export function SiteChrome({ children, settings, navigation }: { children: React.ReactNode; settings: SiteSettings; navigation: PublicNavigationItem[] }) {
  const pathname = usePathname();
  const isBackOffice = pathname.startsWith("/admin") || pathname.startsWith("/auth");
  if (isBackOffice) return <main>{children}</main>;
  return <><Header settings={settings} navigation={navigation} /><main>{children}</main><Footer settings={settings} /><StickyMobileCta /><ConsentManager /></>;
}
