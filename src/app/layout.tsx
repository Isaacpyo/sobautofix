import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { SiteChrome } from "@/components/layout/site-chrome";
import { VehicleSessionProvider } from "@/components/vehicle/vehicle-context";
import { siteConfig } from "@/config/site";
import { getSiteSettings } from "@/lib/settings/repository";
import { getPublicNavigation } from "@/lib/navigation/repository";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "optional", preload: false });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: "700", variable: "--font-barlow", display: "optional", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: { default: `${siteConfig.tagline} | ${siteConfig.name}`, template: `%s | ${siteConfig.name}` },
  description: "Professional vehicle diagnostics, electrical fault finding, repairs, servicing and vehicle sales in Doncaster.",
  applicationName: siteConfig.name,
  verification: { google: process.env.GOOGLE_SEARCH_CONSOLE_VERIFICATION },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#030712" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, navigation] = await Promise.all([getSiteSettings(), getPublicNavigation()]);
  return (
    <html lang="en-GB" data-scroll-behavior="smooth" className={`${inter.variable} ${barlow.variable}`}>
      <body>
        <VehicleSessionProvider>
          <SiteChrome settings={settings} navigation={navigation}>{children}</SiteChrome>
        </VehicleSessionProvider>
      </body>
    </html>
  );
}
