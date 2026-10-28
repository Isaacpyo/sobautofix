import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { formatAddress } from "@/components/exchange/exchange-footer";
import { InfoHero } from "@/components/exchange/info";
import { ButtonLink, Container, Notice } from "@/components/exchange/ui";
import { siteConfig } from "@/config/site";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { formatUkPhone, mapsHref, telHref, whatsappHref } from "@/lib/exchange/public/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeSettings } from "@/lib/exchange/settings";

export async function generateMetadata(): Promise<Metadata> {
  return exchangeMetadata({ title: "Contact us", description: "Call, WhatsApp or email SOB Autofix about buying or selling a car.", path: "/contact" });
}

export default async function ContactPage() {
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);
  const href = (path: string) => exchangeHref(base, path);
  const address = formatAddress(settings.address);
  const options = [
    settings.phone && { icon: Phone, title: "Call us", detail: formatUkPhone(settings.phone), link: telHref(settings.phone), external: false },
    settings.whatsapp && { icon: MessageCircle, title: "WhatsApp", detail: formatUkPhone(settings.whatsapp), link: whatsappHref(settings.whatsapp), external: true },
    settings.email && { icon: Mail, title: "Email", detail: settings.email, link: `mailto:${settings.email}`, external: false },
  ].filter(Boolean) as Array<{ icon: typeof Phone; title: string; detail: string; link: string; external: boolean }>;

  return (
    <>
      <InfoHero eyebrow="Contact" title="Talk to us" intro={<p>Questions about a car, selling your car, or something you are looking for? Get in touch however suits you.</p>} />
      <Container className="grid gap-8 py-10 sm:py-14 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {options.map((option) => (
              <li key={option.title}>
                <a href={option.link} target={option.external ? "_blank" : undefined} rel={option.external ? "noopener noreferrer" : undefined} className="flex h-full min-h-11 flex-col gap-2 rounded-2xl border border-[#E3E8EF] p-5 hover:border-[#1974E2] active:bg-[#EAF2FD]">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#EAF2FD] text-[#1462C4]"><option.icon size={22} aria-hidden="true" /></span>
                  <span className="text-[22px] font-bold text-[#0B1220]">{option.title}</span>
                  <span className="font-semibold break-all text-[#1462C4]">{option.detail}</span>
                </a>
              </li>
            ))}
          </ul>
          <section aria-labelledby="looking-heading" className="mt-8 rounded-2xl bg-[#F3F5F8] p-5">
            <h2 id="looking-heading" className="text-[24px] font-bold text-[#0B1220]">Looking for a particular car?</h2>
            <p className="mt-2 leading-7 text-[#344054]">Tell us the make, model, budget and anything that matters to you by phone, WhatsApp or email. We will let you know if something suitable comes in.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={href("/cars")} variant="secondary">See current stock</ButtonLink>
              <ButtonLink href={href("/sell")} variant="secondary">Sell your car</ButtonLink>
            </div>
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-2xl border border-[#E3E8EF] p-5">
            <h2 className="flex items-center gap-2 text-[22px] font-bold text-[#0B1220]"><MapPin size={20} aria-hidden="true" className="text-[#1462C4]" /> Address</h2>
            <address className="mt-2 leading-7 not-italic">{address}</address>
            <a href={mapsHref(address, siteConfig.googleMapsUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-[#1462C4] hover:underline">Open in maps <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
          <div className="rounded-2xl border border-[#E3E8EF] p-5">
            <h2 className="flex items-center gap-2 text-[22px] font-bold text-[#0B1220]"><Clock size={20} aria-hidden="true" className="text-[#1462C4]" /> Opening hours</h2>
            {settings.openingHours ? <p className="mt-2 leading-7 whitespace-pre-line">{settings.openingHours}</p> : <p className="mt-2 leading-7">Please call to confirm opening times before you visit.</p>}
          </div>
          <Notice>Viewings are by appointment. Please wait for us to confirm a viewing before you travel.</Notice>
        </aside>
      </Container>
    </>
  );
}
