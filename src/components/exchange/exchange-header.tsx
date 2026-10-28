"use client";

import { ArrowUpRight, Phone, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logo from "./assets/sob-autofix-logo.png";
import { useExchangeHref } from "./exchange-base";
import { desktopNavigation, isActivePath } from "./exchange-nav";
import { buttonClass, Container } from "./ui";
import { cn } from "@/lib/utils";

export type HeaderContact = { phone: string; phoneHref: string };

export function ExchangeLogo({ name, shortName, className }: { name: string; shortName: string; className?: string }) {
  const href = useExchangeHref();
  return (
    <Link href={href("/")} aria-label={`${name} home`} className={cn("inline-flex shrink-0 items-center gap-2.5 rounded-lg", className)}>
      <Image src={logo} alt="" sizes="80px" className="h-9 w-auto lg:h-11" preload />
      <span aria-hidden="true" className="h-8 w-px bg-[#E3E8EF]" />
      <span className="flex flex-col leading-none">
        <span className="exchange-display text-[19px] font-bold tracking-tight text-[#0B1220] uppercase lg:text-[22px]">{shortName}</span>
        <span className="mt-0.5 text-[11px] font-medium text-[#5B6575]">by SOB Autofix</span>
      </span>
    </Link>
  );
}

export function ExchangeHeader({ name, shortName, contact, servicesHref, bookHref }: { name: string; shortName: string; contact: HeaderContact; servicesHref: string; bookHref: string }) {
  const pathname = usePathname();
  const href = useExchangeHref();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E3E8EF] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="hidden bg-[#111827] text-[13px] text-[#D0D5DD] lg:block">
        <Container className="flex h-9 items-center justify-between gap-6">
          <p>Used cars, car buying and repairs from one Doncaster workshop.</p>
          <div className="flex items-center gap-5">
            <a href={servicesHref} className="inline-flex items-center gap-1.5 rounded hover:text-white"><Wrench size={14} aria-hidden="true" /> Repairs &amp; Diagnostics</a>
            <a href={bookHref} className="inline-flex items-center gap-1 rounded font-semibold text-white hover:underline">Book a Service <ArrowUpRight size={14} aria-hidden="true" /></a>
            {contact.phoneHref && <a href={contact.phoneHref} className="inline-flex items-center gap-1.5 rounded hover:text-white"><Phone size={14} aria-hidden="true" /> {contact.phone}</a>}
          </div>
        </Container>
      </div>
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <ExchangeLogo name={name} shortName={shortName} />
        <nav aria-label="Main navigation" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {desktopNavigation.map((item) => {
              const active = isActivePath(pathname, item.path);
              return (
                <li key={item.path}>
                  <Link
                    href={href(item.path)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium text-[#344054] hover:bg-[#F3F5F8] hover:text-[#0B1220]",
                      active && "font-semibold text-[#1462C4] after:absolute after:inset-x-3 after:-bottom-[14px] after:h-[3px] after:rounded-full after:bg-[#1974E2]",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={href("/sell")} className={buttonClass("primary", "hidden min-h-11 lg:inline-flex")}>Sell Your Car</Link>
          {contact.phoneHref && (
            <a href={contact.phoneHref} className="inline-flex size-11 items-center justify-center rounded-xl border border-[#E3E8EF] text-[#0B1220] lg:hidden" aria-label={`Call ${name} on ${contact.phone}`}>
              <Phone size={20} aria-hidden="true" />
            </a>
          )}
        </div>
      </Container>
    </header>
  );
}
