import { ArrowRight, Car } from "lucide-react";
import Link from "next/link";
import { exchangeEntryLinks } from "@/config/site";

/**
 * Shown on the main site's /cars-for-sale pages. Links go to the /exchange
 * path on the main site, which works before the exchange subdomain is live
 * and is permanently redirected to it once EXCHANGE_REDIRECTS_ENABLED is set.
 */
export function VisitExchangeBanner({ vehicleSlug }: { vehicleSlug?: string }) {
  const href = vehicleSlug ? `${exchangeEntryLinks.cars}/${encodeURIComponent(vehicleSlug)}` : exchangeEntryLinks.cars;
  return (
    <div className="border-y border-[#1974E2]/20 bg-[#EAF3FF]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="flex items-start gap-3 text-[15px] leading-6 text-[#071127]">
          <Car size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-[#1974E2]" />
          <span><strong>Visit SOB Auto Exchange</strong>, our new home for buying and selling cars: full condition notes, viewing requests and sell-your-car enquiries.</span>
        </p>
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1974E2] px-4 text-sm font-bold text-white hover:bg-[#1446A5]">
          {vehicleSlug ? "View this car on SOB Auto Exchange" : "Visit SOB Auto Exchange"} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
