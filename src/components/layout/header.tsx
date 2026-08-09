"use client";

import { ChevronDown, Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { diagnostics, mainNavigation, services, siteConfig } from "@/config/site";
import { linksForSettings, type SiteSettings } from "@/config/settings";
import type { PublicNavigationItem } from "@/lib/navigation/repository";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Logo } from "./logo";

export function Header({ settings = siteConfig, navigation = [...mainNavigation] }: { settings?: SiteSettings; navigation?: PublicNavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const contactLinks = linksForSettings(settings);
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); } }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return (
    <header className="sticky top-0 z-50 border-b border-[#1974E2]/15 bg-[#030712]/95 text-white backdrop-blur-xl">
      <Container className="flex min-h-20 items-center justify-between gap-4">
        <Logo inverse />
        <nav className="hidden items-center gap-5 xl:flex" aria-label="Primary navigation">
          {navigation.map((item) => <DesktopNavigationItem key={item.href} item={item} />)}
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <a href={contactLinks.phone} aria-label="Call SOB Autofix" className="hidden h-12 w-12 place-items-center rounded-lg border border-[#67B9FF]/30 text-[#67B9FF] hover:bg-[#1974E2]/10 lg:grid"><Phone size={18} /></a>
          <ButtonLink href="/book">Book appointment</ButtonLink>
        </div>
        <button ref={menuButton} className="grid h-12 w-12 place-items-center rounded-lg border border-[#67B9FF]/30 xl:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button>
      </Container>
      <div id="mobile-navigation" className={cn("border-t border-[#1974E2]/15 bg-[#071127] xl:hidden", open ? "block" : "hidden")}>
        <Container className="py-5">
          <nav className="grid" aria-label="Mobile navigation">
            {navigation.map((item) => <Link onClick={() => setOpen(false)} key={item.href} className="border-b border-white/8 py-3 text-base font-semibold text-[#DCE6F2]" href={item.href}>{item.label}</Link>)}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ButtonLink href={contactLinks.phone} variant="secondary">Call</ButtonLink>
            <ButtonLink href="/book">Book</ButtonLink>
          </div>
        </Container>
      </div>
    </header>
  );
}

function DesktopNavigationItem({ item }: { item: PublicNavigationItem }) {
  const children = item.href === "/services"
    ? services.filter((service) => service.published).map((service) => ({ label: service.name, href: `/services/${service.slug}` }))
    : item.href === "/diagnostics"
      ? diagnostics.filter((service) => service.published).map((service) => ({ label: service.name, href: `/diagnostics/${service.slug}` }))
      : [];
  if (!children.length) return <Link className="text-sm font-semibold text-[#DCE6F2] transition hover:text-[#67B9FF]" href={item.href}>{item.label}</Link>;
  return <div className="group relative"><Link aria-haspopup="true" className="flex items-center gap-1 py-7 text-sm font-semibold text-[#DCE6F2] transition hover:text-[#67B9FF]" href={item.href}>{item.label}<ChevronDown size={14} /></Link><div className="invisible absolute top-full left-0 z-50 w-72 -translate-y-2 opacity-0 transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"><div className="grid rounded-xl border border-[#1974E2]/20 bg-[#071127] p-2 shadow-2xl">{children.map((child) => <Link key={child.href} className="rounded-lg px-4 py-3 text-sm font-semibold text-[#DCE6F2] hover:bg-[#1974E2]/15 hover:text-[#67B9FF] focus:bg-[#1974E2]/15" href={child.href}>{child.label}</Link>)}</div></div></div>;
}
