import { ArrowUpRight, BadgeCheck, Building2, ChevronRight, FileText, Handshake, History, Mail, MessageCircle, Phone, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/exchange/ui";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { formatUkPhone, mainSiteHref, telHref, whatsappHref } from "@/lib/exchange/public/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeSettings } from "@/lib/exchange/settings";

export async function generateMetadata(): Promise<Metadata> {
  return exchangeMetadata({ title: "More", path: "/more", index: false });
}

function Row({ href, icon, label, detail, external = false }: { href: string; icon: ReactNode; label: string; detail?: string; external?: boolean }) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2FD] text-[#1462C4]">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-[#0B1220]">{label}</span>{detail && <span className="block truncate text-sm text-[#5B6575]">{detail}</span>}</span>
      {external ? <ArrowUpRight size={18} aria-hidden="true" className="text-[#5B6575]" /> : <ChevronRight size={18} aria-hidden="true" className="text-[#5B6575]" />}
    </>
  );
  const className = "flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-[#F3F5F8] active:bg-[#EAF2FD]";
  return <li>{external ? <a href={href} className={className} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{content}</a> : <Link href={href} className={className}>{content}</Link>}</li>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="px-1 text-sm font-semibold tracking-[.08em] text-[#5B6575] uppercase">{title}</h2>
      <ul className="mt-2 divide-y divide-[#E3E8EF] overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white">{children}</ul>
    </section>
  );
}

export default async function MorePage() {
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);
  const href = (path: string) => exchangeHref(base, path);
  const main = (path: string) => mainSiteHref(base, path);
  return (
    <Container className="max-w-2xl py-8">
      <h1 className="text-[40px] leading-none font-bold text-[#0B1220]">More</h1>
      <div className="mt-6 grid gap-7">
        <Group title="Buying and selling">
          <Row href={href("/part-exchange")} icon={<Handshake size={20} aria-hidden="true" />} label="Part exchange" />
          <Row href={href("/how-buying-works")} icon={<BadgeCheck size={20} aria-hidden="true" />} label="How buying works" detail="Viewing, payment, collection, warranty" />
          <Row href={href("/cars/sold")} icon={<History size={20} aria-hidden="true" />} label="Recently sold" />
          <Row href={href("/about")} icon={<Building2 size={20} aria-hidden="true" />} label="About us" />
        </Group>
        <Group title="Workshop">
          <Row href={main("/services")} icon={<Wrench size={20} aria-hidden="true" />} label="Repairs & Diagnostics" detail={settings.workshopName} external />
          <Row href={main("/book")} icon={<Wrench size={20} aria-hidden="true" />} label="Book a Service" external />
        </Group>
        <Group title="Get in touch">
          {settings.phone && <Row href={telHref(settings.phone)} icon={<Phone size={20} aria-hidden="true" />} label="Call us" detail={formatUkPhone(settings.phone)} external />}
          {settings.whatsapp && <Row href={whatsappHref(settings.whatsapp)} icon={<MessageCircle size={20} aria-hidden="true" />} label="WhatsApp" detail={formatUkPhone(settings.whatsapp)} external />}
          {settings.email && <Row href={`mailto:${settings.email}`} icon={<Mail size={20} aria-hidden="true" />} label="Email" detail={settings.email} external />}
        </Group>
        <Group title="Policies">
          <Row href={href("/policies")} icon={<FileText size={20} aria-hidden="true" />} label="Policies and terms" />
          <Row href={main("/privacy")} icon={<FileText size={20} aria-hidden="true" />} label="Privacy notice" external />
        </Group>
      </div>
    </Container>
  );
}
