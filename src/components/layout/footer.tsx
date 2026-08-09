import Link from "next/link";
import { diagnostics, formatPhone, services, siteConfig } from "@/config/site";
import { linksForSettings, type SiteSettings } from "@/config/settings";
import { Container } from "@/components/ui/container";
import { Logo } from "./logo";

export function Footer({ settings = siteConfig }: { settings?: SiteSettings }) {
  const contactLinks = linksForSettings(settings);
  return (
    <footer className="border-t border-[#1974E2]/20 bg-[#030712] pb-24 pt-16 text-[#C6D2DF] md:pb-8">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
          <div>
            <Logo inverse />
            <p className="mt-5 max-w-sm text-sm leading-7">Professional diagnostics, fault finding, servicing, repairs and vehicle sales from Norton, Doncaster.</p>
            <address className="mt-5 text-sm leading-7 not-italic">{settings.address.building}, {settings.address.street}<br />{settings.address.town}, {settings.address.city}<br />{settings.address.postcode}</address>
          </div>
          <FooterGroup title="Diagnostics" links={diagnostics.filter((item) => item.published).slice(0, 5).map((item) => ({ label: item.name, href: `/diagnostics/${item.slug}` }))} />
          <FooterGroup title="Services" links={[...services.filter((item) => item.published).map((item) => ({ label: item.name, href: `/services/${item.slug}` })), { label: "Mobile mechanic", href: "/mobile-mechanic" }, { label: "Vehicle inspections", href: "/vehicle-inspections" }]} />
          <div>
            <h2 className="text-lg font-bold text-white">Contact</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <a className="hover:text-[#67B9FF]" href={contactLinks.phone}>{formatPhone(settings.phone)}</a>
              <a className="hover:text-[#67B9FF]" href={contactLinks.whatsapp}>WhatsApp: {formatPhone(settings.whatsapp)}</a>
              <a className="break-all hover:text-[#67B9FF]" href={contactLinks.email}>{settings.email}</a>
              <Link className="hover:text-[#67B9FF]" href="/contact">Contact & directions</Link>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-7 text-xs text-[#8F9EAF] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.legalName}. Company No. {settings.companyNumber}.</p>
          <div className="flex gap-5"><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/terms">Terms</Link></div>
        </div>
      </Container>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return <div><h2 className="text-lg font-bold text-white">{title}</h2><div className="mt-4 grid gap-3 text-sm">{links.map((item) => <Link className="hover:text-[#67B9FF]" key={item.href} href={item.href}>{item.label}</Link>)}</div></div>;
}
