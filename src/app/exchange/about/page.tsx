import { ArrowUpRight, Building2, Car, Repeat, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { formatAddress } from "@/components/exchange/exchange-footer";
import { InfoHero } from "@/components/exchange/info";
import { workshopPhotos } from "@/components/exchange/photos";
import { ButtonLink, Container } from "@/components/exchange/ui";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { mainSiteHref } from "@/lib/exchange/public/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeSettings } from "@/lib/exchange/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getExchangeSettings();
  return exchangeMetadata({ title: "About us", description: `${settings.name} is the used car sales and buying service of ${settings.legalName}, a repair and diagnostics workshop in Doncaster.`, path: "/about" });
}

export default async function AboutPage() {
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);
  const href = (path: string) => exchangeHref(base, path);
  return (
    <>
      <InfoHero eyebrow="About us" title={`${settings.name} is run by ${settings.workshopName}`} intro={<p>We are a repair and diagnostics workshop in {settings.address.city}. Through {settings.name} we sell cars we own and buy cars from local drivers. You deal with us directly: there are no third-party sellers, auctions or bidding.</p>} />
      <Container className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-4">
          {[
            { icon: Car, title: "The seller", body: `When you buy a car here, you buy it from ${settings.legalName}. Listings show what we know about each car, and anything we have not confirmed is marked as such.` },
            { icon: Repeat, title: "The buyer", body: `When you sell or part exchange a car, ${settings.legalName} is the buyer. Any offer is subject to inspection and verification.` },
            { icon: Wrench, title: "The workshop", body: `${settings.workshopName} provides servicing, repairs and diagnostics, separately from car sales.` },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 rounded-2xl border border-[#E3E8EF] p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF2FD] text-[#1462C4]"><item.icon size={22} aria-hidden="true" /></span>
              <div><h2 className="text-[24px] font-bold text-[#0B1220]">{item.title}</h2><p className="mt-1 leading-7 text-[#344054]">{item.body}</p></div>
            </div>
          ))}
          <section aria-labelledby="legal-heading" className="rounded-2xl bg-[#F3F5F8] p-5">
            <h2 id="legal-heading" className="flex items-center gap-2 text-[24px] font-bold text-[#0B1220]"><Building2 size={22} aria-hidden="true" className="text-[#1462C4]" /> Company details</h2>
            <dl className="mt-3 grid gap-2 text-[15px]">
              <div className="grid grid-cols-[9rem_1fr] gap-3"><dt className="text-[#5B6575]">Legal name</dt><dd className="font-semibold text-[#0B1220]">{settings.legalName}</dd></div>
              {settings.companyNumber && <div className="grid grid-cols-[9rem_1fr] gap-3"><dt className="text-[#5B6575]">Company number</dt><dd className="font-semibold text-[#0B1220]">{settings.companyNumber} (England and Wales)</dd></div>}
              <div className="grid grid-cols-[9rem_1fr] gap-3"><dt className="text-[#5B6575]">Address</dt><dd className="font-semibold text-[#0B1220]">{formatAddress(settings.address)}</dd></div>
            </dl>
          </section>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={href("/cars")}>Browse cars</ButtonLink>
            <a href={mainSiteHref(base, "/about")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#C9D3E0] px-5 text-[15px] font-semibold text-[#0B1220] hover:border-[#1974E2]">About the workshop <ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
          <Image src={workshopPhotos.about.src} alt={workshopPhotos.about.alt} fill sizes="(max-width: 1023px) 100vw, 480px" className="object-cover" />
        </div>
      </Container>
    </>
  );
}
