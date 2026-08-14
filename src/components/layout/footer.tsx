import { ArrowRight, ChevronDown, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SocialLinks } from "@/components/marketing/social-links";
import { diagnostics, formatPhone, services, siteConfig } from "@/config/site";
import { linksForSettings, type SiteSettings } from "@/config/settings";
import { Logo } from "./logo";

type FooterLink = { label: string; href: string };

const diagnosticLinks: FooterLink[] = diagnostics
  .filter((item) => item.published)
  .map((item) => ({ label: item.name, href: `/diagnostics/${item.slug}` }));

const serviceLinks: FooterLink[] = [
  ...services
    .filter((item) => item.published)
    .map((item) => ({ label: item.name, href: `/services/${item.slug}` })),
  { label: "Mobile Mechanic", href: "/mobile-mechanic" },
  { label: "Vehicle Recovery", href: "/vehicle-recovery" },
  { label: "Pre-Purchase Inspection", href: "/vehicle-inspections" },
  { label: "Fleet Servicing", href: "/fleet" },
];

const exploreLinks: FooterLink[] = [
  { label: "Who We Are", href: "/about" },
  { label: "News & Blog", href: "/news" },
  { label: "FAQs", href: "/faqs" },
  { label: "Gallery", href: "/gallery" },
  { label: "Cars for Sale", href: "/cars-for-sale" },
  { label: "Get a Quote", href: "/get-a-quote" },
  { label: "Book Appointment", href: "/book" },
  { label: "Contact", href: "/contact" },
];

export function Footer({ settings = siteConfig }: { settings?: SiteSettings }) {
  const contactLinks = linksForSettings(settings);
  const directionsHref = settings.googleMapsUrl || "/contact";

  return (
    <footer className="footer-premium relative overflow-hidden border-t border-[#1974E2]/20 bg-[#030712] pb-8 pt-14 text-[#C6D2DF] lg:pt-16">
      <Container>
        <div className="grid gap-x-8 gap-y-0 md:grid-cols-2 md:gap-y-12 xl:grid-cols-[1.35fr_.95fr_.95fr_.9fr_1.1fr]">
          <div>
            <div className="w-32">
              <Logo inverse />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7">
              Professional diagnostics, fault finding, servicing, repairs and vehicle sales across Doncaster and South Yorkshire.
            </p>
            <div className="mt-6">
              <h2 className="text-sm font-bold text-white">Follow SOB Autofix</h2>
              <SocialLinks socials={settings.socials} className="mt-3 text-[#C6D2DF]" />
            </div>
          </div>

          <FooterGroup title="Diagnostics" titleHref="/diagnostics" links={diagnosticLinks} />

          <FooterGroup
            title="Services"
            titleHref="/services"
            links={serviceLinks}
            action={{ label: "View All Services", href: "/services" }}
          />

          <FooterGroup title="Explore" links={exploreLinks} />

          <FooterContact settings={settings} contactLinks={contactLinks} directionsHref={directionsHref} />
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-white/10 px-5 py-5 text-center text-xs text-[#8F9EAF] md:flex-row md:justify-between md:text-left">
          <p>© 2026 {settings.legalName} · Company No. {settings.companyNumber}</p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 md:justify-end">
            <Link className="hover:text-white" href="/privacy">Privacy</Link>
            <Link className="hover:text-white" href="/cookies">Cookies</Link>
            <Link className="hover:text-white" href="/terms">Terms</Link>
          </nav>
        </div>
      </Container>
    </footer>
  );
}

function FooterGroup({
  title,
  titleHref,
  links,
  action,
}: {
  title: string;
  titleHref?: string;
  links: FooterLink[];
  action?: FooterLink;
}) {
  return (
    <div>
      <details className="group border-b border-white/10 md:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-white marker:content-none">
          {title}
          <ChevronDown size={18} className="shrink-0 text-[#67B9FF] transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <nav aria-label={`${title} footer links`} className="grid gap-3 pb-5 pl-2 text-sm">
          {titleHref && !action && <Link className="font-bold text-white hover:text-[#67B9FF]" href={titleHref}>View all {title.toLowerCase()} <ArrowRight size={14} className="ml-1 inline" /></Link>}
          <FooterLinks links={links} action={action} />
        </nav>
      </details>
      <nav aria-label={`${title} footer links`} className="hidden md:block">
        <h2 className="text-lg font-bold text-white">{titleHref ? <Link href={titleHref} className="inline-flex items-center gap-2 hover:text-[#67B9FF]">{title}<ArrowRight size={15} /></Link> : title}</h2>
        <div className="mt-4 grid gap-2.5 text-sm"><FooterLinks links={links} action={action} /></div>
      </nav>
    </div>
  );
}

function FooterLinks({ links, action }: { links: FooterLink[]; action?: FooterLink }) {
  return <>
    {links.map((item) => <Link className="leading-5 hover:text-[#67B9FF]" key={item.href} href={item.href}>{item.label}</Link>)}
    {action && <Link className="mt-2 inline-flex items-center gap-2 font-bold text-white hover:text-[#67B9FF]" href={action.href}>{action.label} <ArrowRight size={15} /></Link>}
  </>;
}

function FooterContact({ settings, contactLinks, directionsHref }: { settings: SiteSettings; contactLinks: ReturnType<typeof linksForSettings>; directionsHref: string }) {
  const content = <ContactDetails settings={settings} contactLinks={contactLinks} directionsHref={directionsHref} />;
  return <div><details className="group border-b border-white/10 md:hidden"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-white marker:content-none">Contact<ChevronDown size={18} className="shrink-0 text-[#67B9FF] transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="pb-5">{content}</div></details><div className="hidden md:block"><h2 className="text-lg font-bold text-white">Contact</h2>{content}</div></div>;
}

function ContactDetails({ settings, contactLinks, directionsHref }: { settings: SiteSettings; contactLinks: ReturnType<typeof linksForSettings>; directionsHref: string }) {
  return <div className="mt-4 grid gap-3 text-sm"><a className="inline-flex items-start gap-2 hover:text-[#67B9FF]" href={contactLinks.phone}><Phone size={16} className="mt-0.5 shrink-0 text-[#67B9FF]" />{formatPhone(settings.phone)}</a><a className="inline-flex items-start gap-2 hover:text-[#67B9FF]" href={contactLinks.whatsapp}><MessageCircle size={16} className="mt-0.5 shrink-0 text-[#67B9FF]" />WhatsApp: {formatPhone(settings.whatsapp)}</a><a className="inline-flex min-w-0 items-start gap-2 break-all hover:text-[#67B9FF]" href={contactLinks.email}><Mail size={16} className="mt-0.5 shrink-0 text-[#67B9FF]" />{settings.email}</a><a className="flex items-start gap-2 hover:text-[#67B9FF]" href={directionsHref} target={settings.googleMapsUrl ? "_blank" : undefined} rel={settings.googleMapsUrl ? "noreferrer" : undefined}><MapPin size={16} className="mt-1 shrink-0 text-[#67B9FF]" /><BusinessAddress settings={settings} /></a></div>;
}

function BusinessAddress({
  settings,
  className,
}: {
  settings: SiteSettings;
  className?: string;
}) {
  return (
    <address className={cnAddress("text-sm leading-6 not-italic", className)}>
      {settings.address.building}, {settings.address.street}<br />
      {settings.address.town}, {settings.address.city}<br />
      {settings.address.postcode}
    </address>
  );
}

function cnAddress(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}
