import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { exchangePolicyPages } from "@/config/exchange";
import { exchangeHref } from "@/lib/exchange/host";
import { formatUkPhone, mainSiteHref, telHref, whatsappHref } from "@/lib/exchange/public/links";
import type { ResolvedExchangeSettings } from "@/lib/exchange/settings";
import { Container } from "./ui";

export function formatAddress(address: ResolvedExchangeSettings["address"]) {
  return [address.building, address.street, address.town, address.city, address.postcode].filter(Boolean).join(", ");
}

export function ExchangeFooter({ settings, base }: { settings: ResolvedExchangeSettings; base: string }) {
  const href = (path: string) => exchangeHref(base, path);
  const main = (path: string) => mainSiteHref(base, path);
  const linkClass = "inline-flex min-h-9 items-center rounded text-[#D0D5DD] hover:text-white";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#111827] text-[15px] text-[#D0D5DD]">
      <Container className="grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-16">
        <div>
          <p className="font-[family-name:var(--font-barlow)] text-[28px] font-bold text-white uppercase">{settings.name}</p>
          <p className="mt-3 max-w-sm leading-7">{settings.tagline}</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#AEB6C2]">
            {settings.name} is the vehicle sales and buying service of {settings.legalName}, trading as {settings.workshopName}.
            {settings.companyNumber ? ` Registered in England and Wales, company number ${settings.companyNumber}.` : ""}
          </p>
        </div>
        <nav aria-label="Buying and selling">
          <h2 className="text-sm font-semibold tracking-[.08em] text-white uppercase">Buy and sell</h2>
          <ul className="mt-3 grid gap-1">
            <li><Link className={linkClass} href={href("/cars")}>Browse cars</Link></li>
            <li><Link className={linkClass} href={href("/cars/sold")}>Recently sold</Link></li>
            <li><Link className={linkClass} href={href("/sell")}>Sell your car</Link></li>
            <li><Link className={linkClass} href={href("/part-exchange")}>Part exchange</Link></li>
            <li><Link className={linkClass} href={href("/how-buying-works")}>How buying works</Link></li>
            <li><Link className={linkClass} href={href("/about")}>About us</Link></li>
          </ul>
        </nav>
        <nav aria-label="SOB Autofix workshop">
          <h2 className="text-sm font-semibold tracking-[.08em] text-white uppercase">Workshop</h2>
          <ul className="mt-3 grid gap-1">
            <li><a className={linkClass} href={main("/")}>{settings.workshopName} <ArrowUpRight size={14} className="ml-1" aria-hidden="true" /></a></li>
            <li><a className={linkClass} href={main("/services")}>Repairs &amp; servicing</a></li>
            <li><a className={linkClass} href={main("/diagnostics")}>Diagnostics</a></li>
            <li><a className={linkClass} href={main("/book")}>Book a service</a></li>
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-semibold tracking-[.08em] text-white uppercase">Contact</h2>
          <ul className="mt-3 grid gap-2.5">
            {settings.phone && <li><a className="inline-flex min-h-9 items-center gap-2 rounded hover:text-white" href={telHref(settings.phone)}><Phone size={16} aria-hidden="true" className="text-[#7DB5F5]" /> {formatUkPhone(settings.phone)}</a></li>}
            {settings.whatsapp && <li><a className="inline-flex min-h-9 items-center gap-2 rounded hover:text-white" href={whatsappHref(settings.whatsapp)} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true" className="text-[#7DB5F5]" /> WhatsApp {formatUkPhone(settings.whatsapp)}</a></li>}
            {settings.email && <li><a className="inline-flex min-h-9 items-center gap-2 rounded break-all hover:text-white" href={`mailto:${settings.email}`}><Mail size={16} aria-hidden="true" className="shrink-0 text-[#7DB5F5]" /> {settings.email}</a></li>}
            <li className="flex gap-2 leading-6"><MapPin size={16} aria-hidden="true" className="mt-1 shrink-0 text-[#7DB5F5]" /> <address className="not-italic">{formatAddress(settings.address)}</address></li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-4 py-6 text-sm text-[#AEB6C2] lg:flex-row lg:items-center lg:justify-between">
          <p>&copy; {year} {settings.legalName}. All rights reserved.</p>
          <nav aria-label="Policies">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {exchangePolicyPages.map((page) => <li key={page.slug}><Link className={linkClass} href={href(`/policies/${page.slug}`)}>{page.title}</Link></li>)}
              <li><a className={linkClass} href={main("/privacy")}>Privacy notice</a></li>
              <li><a className={linkClass} href={main("/cookies")}>Cookies</a></li>
            </ul>
          </nav>
        </Container>
      </div>
    </footer>
  );
}
