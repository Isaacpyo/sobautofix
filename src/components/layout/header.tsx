"use client";

import { ArrowRight, ChevronDown, Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { diagnostics, services, siteConfig } from "@/config/site";
import { linksForSettings, type SiteSettings } from "@/config/settings";
import type { PublicNavigationItem } from "@/lib/navigation/repository";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type NavLink = { label: string; href: string };
type NavigationGroupData = { title: string; href?: string; links: NavLink[] };
type MenuName = "who" | "services";

const whoWeAreGroups: NavigationGroupData[] = [
  {
    title: "About",
    links: [{ label: "Who We Are", href: "/about" }],
  },
  {
    title: "Helpful information",
    links: [
      { label: "FAQs", href: "/faqs" },
      { label: "Gallery", href: "/gallery" },
    ],
  },
];

const serviceGroups: NavigationGroupData[] = [
  {
    title: "Diagnostics",
    href: "/diagnostics",
    links: diagnostics
      .filter((item) => item.published)
      .map((item) => ({ label: item.name, href: `/diagnostics/${item.slug}` })),
  },
  {
    title: "Repairs & Maintenance",
    href: "/services/repairs-maintenance",
    links: services
      .filter((item) => item.published)
      .map((item) => ({ label: item.name, href: `/services/${item.slug}` })),
  },
  {
    title: "Mobile & Specialist",
    href: "/services/mobile-specialist",
    links: [
      { label: "Mobile Mechanic", href: "/mobile-mechanic" },
      { label: "Vehicle Recovery", href: "/vehicle-recovery" },
      { label: "Pre-Purchase Inspection", href: "/vehicle-inspections" },
      { label: "Fleet Servicing", href: "/fleet" },
    ],
  },
];

const whoWeArePaths = whoWeAreGroups.flatMap((group) => group.links.map((item) => item.href));
const servicePaths = [
  "/services",
  "/diagnostics",
  ...serviceGroups.flatMap((group) => group.links.map((item) => item.href)),
];

type HeaderProps = {
  settings?: SiteSettings;
  navigation?: PublicNavigationItem[];
};

export function Header({ settings = siteConfig }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MenuName | null>(null);
  const [desktopMenu, setDesktopMenu] = useState<MenuName | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const contactLinks = linksForSettings(settings);

  function closeMobileMenu() {
    setMobileOpen(false);
    setMobileSection(null);
  }

  useEffect(() => {
    if (!mobileOpen && !desktopMenu) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (mobileOpen) {
        closeMobileMenu();
        menuButton.current?.focus();
        return;
      }

      if (desktopMenu) {
        const trigger = document.getElementById(`desktop-${desktopMenu}-trigger`);
        setDesktopMenu(null);
        trigger?.focus();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [desktopMenu, mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#030712]/96 text-white shadow-[0_10px_35px_rgba(3,7,18,0.18)] backdrop-blur-xl">
        <Container className="flex h-[4.5rem] items-center gap-2 sm:gap-3 xl:h-20 xl:gap-5">
        <button
          ref={menuButton}
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 text-[#DCE6F2] transition hover:border-[#67B9FF]/55 hover:bg-[#1974E2]/15 hover:text-white xl:hidden"
          onClick={() => setMobileOpen((value) => !value)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        <div className="mr-auto hidden w-[7.5rem] shrink-0 xl:block">
          <Logo inverse />
        </div>

        <nav className="hidden items-stretch self-stretch xl:flex" aria-label="Primary navigation">
          <DesktopDropdown
            name="who"
            label="Who we are"
            active={isAnyPathActive(pathname, whoWeArePaths)}
            open={desktopMenu === "who"}
            onOpen={() => setDesktopMenu("who")}
            onClose={() => setDesktopMenu(null)}
          >
            <div className="w-[27rem] p-3">
              <div className="grid grid-cols-2 gap-2">
                {whoWeAreGroups.map((group) => (
                  <NavigationGroup
                    key={group.title}
                    group={group}
                    pathname={pathname}
                    onNavigate={() => setDesktopMenu(null)}
                  />
                ))}
              </div>
            </div>
          </DesktopDropdown>

          <DesktopDropdown
            name="services"
            label="Services"
            active={isAnyPathActive(pathname, servicePaths)}
            open={desktopMenu === "services"}
            onOpen={() => setDesktopMenu("services")}
            onClose={() => setDesktopMenu(null)}
          >
            <div className="w-[min(820px,calc(100vw-2rem))]">
              <div className="grid grid-cols-3 gap-2 p-3">
                {serviceGroups.map((group) => (
                  <NavigationGroup
                    key={group.title}
                    group={group}
                    pathname={pathname}
                    onNavigate={() => setDesktopMenu(null)}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-5 border-t border-white/10 bg-white/[0.035] px-5 py-4">
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[#67B9FF]"
                  onClick={() => setDesktopMenu(null)}
                >
                  View All Services <ArrowRight size={15} />
                </Link>
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#67B9FF] hover:text-white"
                  onClick={() => setDesktopMenu(null)}
                >
                  Book Appointment <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </DesktopDropdown>

          <DesktopLink label="Cars for Sale" href="/cars-for-sale" pathname={pathname} />
          <DesktopLink label="News & Blog" href="/news" pathname={pathname} />
          <DesktopLink label="Contact" href="/contact" pathname={pathname} />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={contactLinks.phone}
            aria-label="Call SOB Autofix"
            className="grid size-11 place-items-center rounded-full border border-white/15 text-[#67B9FF] transition hover:border-[#67B9FF]/55 hover:bg-[#1974E2]/15 hover:text-white"
          >
            <Phone size={17} />
          </a>
          <ButtonLink
            href="/book"
            className="min-h-10 whitespace-nowrap rounded-full px-4 py-2 text-xs sm:min-h-11 sm:px-5 sm:text-sm"
          >
            Book appointment
          </ButtonLink>
        </div>
        </Container>
      </header>

      <div
        className={cn(
          "fixed inset-x-0 top-[4.5rem] bottom-0 z-50 xl:hidden",
          mobileOpen ? "visible pointer-events-auto" : "invisible pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          className={cn(
            "absolute inset-0 bg-[#030712]/70 transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={closeMobileMenu}
        />
        <div
          id="mobile-navigation"
          className={cn(
            "absolute inset-y-0 left-0 z-10 w-[min(24rem,calc(100vw-3rem))] overflow-y-auto overscroll-contain border-r border-white/10 bg-[#071127] shadow-2xl transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="px-5 py-7 sm:px-7">
            <p className="mb-4 text-[0.68rem] font-extrabold tracking-[0.18em] text-[#67B9FF] uppercase">
              Menu
            </p>
            <nav className="grid" aria-label="Mobile navigation">
              <MobileAccordion
                id="mobile-who-we-are"
                label="Who we are"
                expanded={mobileSection === "who"}
                active={isAnyPathActive(pathname, whoWeArePaths)}
                onToggle={() => setMobileSection((value) => value === "who" ? null : "who")}
              >
                <div className="grid gap-5 px-3 py-5">
                  {whoWeAreGroups.map((group) => (
                    <MobileLinkGroup key={group.title} group={group} onNavigate={closeMobileMenu} />
                  ))}
                </div>
              </MobileAccordion>

              <MobileAccordion
                id="mobile-services"
                label="Services"
                expanded={mobileSection === "services"}
                active={isAnyPathActive(pathname, servicePaths)}
                onToggle={() => setMobileSection((value) => value === "services" ? null : "services")}
              >
                <div className="grid gap-2 px-2 py-4">
                  {serviceGroups.map((group) => (
                    <section key={group.title} className="rounded-xl bg-white/[0.035] p-3">
                      <Link href={group.href!} className="flex min-h-11 items-center justify-between gap-3 text-sm font-extrabold tracking-wide text-white uppercase hover:text-[#67B9FF]" onClick={closeMobileMenu}>
                        {group.title}<ArrowRight size={15} className="shrink-0 text-[#67B9FF]" />
                      </Link>
                      <div className="grid">
                        {group.links.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex min-h-11 items-center border-t border-white/8 text-sm text-[#C6D2DF] hover:text-white"
                            onClick={closeMobileMenu}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                  <Link
                    href="/services"
                    className="mt-2 inline-flex min-h-12 items-center gap-2 px-3 text-sm font-bold text-[#67B9FF] hover:text-white"
                    onClick={closeMobileMenu}
                  >
                    View All Services <ArrowRight size={15} />
                  </Link>
                </div>
              </MobileAccordion>

              <MobileNavigationItem label="Cars for Sale" href="/cars-for-sale" pathname={pathname} onNavigate={closeMobileMenu} />
              <MobileNavigationItem label="News & Blog" href="/news" pathname={pathname} onNavigate={closeMobileMenu} />
              <MobileNavigationItem label="Contact" href="/contact" pathname={pathname} onNavigate={closeMobileMenu} />
            </nav>

            <a
              className="mt-8 inline-flex items-center gap-2 border-t border-white/10 pt-6 font-bold text-white hover:text-[#67B9FF]"
              href={contactLinks.phone}
            >
              <Phone size={17} className="text-[#67B9FF]" />
              {settings.phone}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function DesktopDropdown({
  name,
  label,
  active,
  open,
  onOpen,
  onClose,
  children,
}: {
  name: MenuName;
  label: string;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex items-stretch"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onFocus={onOpen}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose();
      }}
    >
      <button
        id={`desktop-${name}-trigger`}
        type="button"
        className={desktopLinkClasses(active || open)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`desktop-${name}-menu`}
        onClick={() => open ? onClose() : onOpen()}
      >
        {label}
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={`desktop-${name}-menu`}
        className={cn(
          "absolute top-full left-1/2 z-50 -translate-x-1/2 pt-2 transition duration-150",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
        )}
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#071127] shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function NavigationGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: NavigationGroupData;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="rounded-xl p-2">
      {group.href ? <Link href={group.href} className="mb-2 flex min-h-8 items-center gap-1 px-2 text-[0.68rem] font-extrabold tracking-[0.15em] text-[#67B9FF] uppercase hover:text-white" onClick={onNavigate}>{group.title}<ArrowRight size={12} /></Link> : <p className="mb-2 px-2 text-[0.68rem] font-extrabold tracking-[0.15em] text-[#67B9FF] uppercase">{group.title}</p>}
      <div className="grid">
        {group.links.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-2 py-2 text-[0.82rem] font-semibold text-[#C6D2DF] transition hover:bg-[#1974E2]/15 hover:text-white focus-visible:bg-[#1974E2]/15",
                active && "bg-[#1974E2]/15 text-[#67B9FF]",
              )}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DesktopLink({ label, href, pathname }: NavLink & { pathname: string }) {
  const active = isActivePath(pathname, href);
  return (
    <Link className={desktopLinkClasses(active)} href={href} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}

function MobileAccordion({
  id,
  label,
  expanded,
  active,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/8">
      <button
        type="button"
        className={cn(
          "flex min-h-14 w-full items-center justify-between gap-3 text-left text-base font-bold text-[#DCE6F2]",
          active && "text-[#67B9FF]",
        )}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={onToggle}
      >
        {label}
        <ChevronDown size={18} className={cn("shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && <div id={id}>{children}</div>}
    </div>
  );
}

function MobileLinkGroup({
  group,
  onNavigate,
}: {
  group: NavigationGroupData;
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[0.65rem] font-extrabold tracking-[0.14em] text-[#67B9FF] uppercase">
        {group.title}
      </p>
      <div className="grid">
        {group.links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 items-center text-sm font-semibold text-[#DCE6F2] hover:text-white"
            onClick={onNavigate}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MobileNavigationItem({
  label,
  href,
  pathname,
  onNavigate,
}: NavLink & {
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isActivePath(pathname, href);
  return (
    <Link
      className={cn(
        "flex min-h-14 items-center border-b border-white/8 text-base font-bold text-[#DCE6F2] transition hover:text-white",
        active && "text-[#67B9FF]",
      )}
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAnyPathActive(pathname: string, hrefs: string[]) {
  return hrefs.some((href) => isActivePath(pathname, href));
}

function desktopLinkClasses(active: boolean) {
  return cn(
    "relative flex items-center gap-1.5 px-2.5 text-[0.82rem] font-bold whitespace-nowrap text-[#C6D2DF] transition hover:text-white 2xl:px-3.5 2xl:text-sm",
    "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[#168BFF] after:transition-transform hover:after:scale-x-100 focus-visible:after:scale-x-100",
    active && "text-white after:scale-x-100",
  );
}
