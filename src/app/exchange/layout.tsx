import type { Metadata, Viewport } from "next";
import { ExchangeBaseProvider } from "@/components/exchange/exchange-base";
import { ExchangeBottomNav } from "@/components/exchange/exchange-bottom-nav";
import { ExchangeFeedbackProvider } from "@/components/exchange/feedback";
import { ExchangeFooter } from "@/components/exchange/exchange-footer";
import { ExchangeHeader } from "@/components/exchange/exchange-header";
import { getExchangeBase } from "@/lib/exchange/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { formatUkPhone, mainSiteHref, telHref } from "@/lib/exchange/public/links";
import { getExchangeSettings } from "@/lib/exchange/settings";
import "./exchange.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getExchangeSettings();
  return { ...(await exchangeMetadata({ path: "/" })), applicationName: settings.name };
}

export const viewport: Viewport = { themeColor: "#FFFFFF", viewportFit: "cover" };

export default async function ExchangeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);

  return (
    <ExchangeBaseProvider base={base}>
      <ExchangeFeedbackProvider>
      <div className="exchange-app flex min-h-dvh flex-col bg-white text-[#344054] [--exchange-bottom-space:calc(64px_+_env(safe-area-inset-bottom))] has-[[data-exchange-action-bar]]:[--exchange-bottom-space:calc(152px_+_env(safe-area-inset-bottom))]">
        <a href="#exchange-main" className="sr-only z-50 rounded-lg bg-[#0B1220] px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
        <ExchangeHeader
          name={settings.name}
          shortName={settings.shortName}
          contact={{ phone: formatUkPhone(settings.phone), phoneHref: telHref(settings.phone) }}
          servicesHref={mainSiteHref(base, "/services")}
          bookHref={mainSiteHref(base, "/book")}
        />
        <main id="exchange-main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
        <div className="pb-[var(--exchange-bottom-space)] lg:pb-0">
          <ExchangeFooter settings={settings} base={base} />
        </div>
        <ExchangeBottomNav />
      </div>
      </ExchangeFeedbackProvider>
    </ExchangeBaseProvider>
  );
}
