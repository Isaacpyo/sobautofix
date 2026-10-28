"use client";

import { Car, Home, Menu, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useExchangeHref } from "./exchange-base";
import { bottomNavSection, type BottomNavKey } from "./exchange-nav";
import { cn } from "@/lib/utils";

const items: Array<{ key: BottomNavKey; label: string; path: string; icon: typeof Home }> = [
  { key: "home", label: "Home", path: "/", icon: Home },
  { key: "cars", label: "Browse Cars", path: "/cars", icon: Car },
  { key: "sell", label: "Sell My Car", path: "/sell", icon: Plus },
  { key: "contact", label: "Contact", path: "/contact", icon: MessageSquare },
  { key: "more", label: "More", path: "/more", icon: Menu },
];

/**
 * Mobile bottom navigation (ARCHITECTURE.md): 64px white bar plus the safe
 * area, five equal columns, raised accent centre item. Hidden at lg and up.
 */
export function ExchangeBottomNav() {
  const pathname = usePathname();
  const href = useExchangeHref();
  const current = bottomNavSection(pathname);

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E3E8EF] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {items.map((item) => {
          const active = current === item.key;
          const Icon = item.icon;
          if (item.key === "sell") {
            return (
              <li key={item.key} className="relative flex justify-center">
                <Link
                  href={href(item.path)}
                  aria-current={active ? "page" : undefined}
                  className="group absolute -top-4 flex w-full flex-col items-center gap-1 rounded-xl pb-1"
                >
                  <span className={cn("grid size-14 place-items-center rounded-full bg-[#1974E2] text-white shadow-[0_6px_16px_rgba(25,116,226,.4)] ring-4 ring-white group-hover:bg-[#1462C4]", active && "bg-[#1462C4]")}>
                    <Icon size={26} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span className={cn("text-[11px] leading-none font-semibold", active ? "text-[#1462C4]" : "text-[#0B1220]")}>{item.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.key} className="flex">
              <Link
                href={href(item.path)}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] leading-none font-semibold", active ? "text-[#1462C4]" : "text-[#5B6575] hover:text-[#0B1220]")}
              >
                <Icon size={22} aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
