import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
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
    <footer className="border-t border-[#1974E2]/20 bg-[#030712] pb-24 pt-14 text-[#C6D2DF] md:pb-8 lg:pt-16">
      <Container>
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-[1.35fr_.95fr_.95fr_.9fr_1.1fr]">
          <div>
            <div className="w-32">
              <Logo inverse />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7">
              Professional diagnostics, fault finding, servicing, repairs and vehicle sales across Doncaster and South Yorkshire.
            </p>
            <p className="mt-5 font-[family-name:var(--font-barlow)] text-xl font-bold text-white">
              Professional Diagnostics. Not Guesswork.
            </p>
            <BusinessAddress settings={settings} className="mt-5" />
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

          <div>
            <h2 className="text-lg font-bold text-white">Contact</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <a className="inline-flex items-start gap-2 hover:text-[#67B9FF]" href={contactLinks.phone}>
                <Phone size={16} className="mt-0.5 shrink-0 text-[#67B9FF]" />
                {formatPhone(settings.phone)}
              </a>
              <a className="inline-flex items-start gap-2 hover:text-[#67B9FF]" href={contactLinks.whatsapp}>
                <MessageCircle size={16} className="mt-0.5 shrink-0 text-[#67B9FF]" />
                WhatsApp: {formatPhone(settings.whatsapp)}
              </a>
              <a className="inline-flex min-w-0 items-start gap-2 break-all hover:text-[#67B9FF]" href={contactLinks.email}>
                <Mail size={16} className="mt-0.5 shrink-0 text-[#67B9FF]" />
                {settings.email}
              </a>
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-1 shrink-0 text-[#67B9FF]" />
                <BusinessAddress settings={settings} />
              </div>
              <a
                className="mt-1 inline-flex items-center gap-2 font-bold text-white hover:text-[#67B9FF]"
                href={directionsHref}
                target={settings.googleMapsUrl ? "_blank" : undefined}
                rel={settings.googleMapsUrl ? "noreferrer" : undefined}
              >
                Get Directions <ArrowRight size={15} />
              </a>
            </div>
            <div className="mt-5 grid gap-2">
              <ButtonLink href="/book" className="min-h-11 w-full whitespace-nowrap rounded-full py-2.5">
                Book Appointment
              </ButtonLink>
              <ButtonLink
                href={contactLinks.whatsapp}
                variant="secondary"
                className="min-h-11 w-full whitespace-nowrap rounded-full py-2.5"
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp Us
              </ButtonLink>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-7 text-xs text-[#8F9EAF] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {settings.legalName} · Company No. {settings.companyNumber}</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
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
    <nav aria-label={`${title} footer links`}>
      <h2 className="text-lg font-bold text-white">{titleHref ? <Link href={titleHref} className="inline-flex items-center gap-2 hover:text-[#67B9FF]">{title}<ArrowRight size={15} /></Link> : title}</h2>
      <div className="mt-4 grid gap-2.5 text-sm">
        {links.map((item) => (
          <Link className="leading-5 hover:text-[#67B9FF]" key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        {action && (
          <Link className="mt-2 inline-flex items-center gap-2 font-bold text-white hover:text-[#67B9FF]" href={action.href}>
            {action.label} <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </nav>
  );
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
