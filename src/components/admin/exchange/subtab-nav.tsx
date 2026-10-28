"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type ExchangeTab = { href: string; label: string };

export function ExchangeSubtabNav({ tabs }: { tabs: ExchangeTab[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const activeHref = tabs.filter((tab) => tab.href === "/admin/exchange" ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>("[aria-current='page']");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeHref]);

  return <nav aria-label="Vehicle Buying & Selling sections" className="relative -mx-5 mt-4 border-b border-[#E4EAF0] px-5 lg:mx-0 lg:px-0">
    <ul ref={listRef} className="flex gap-1 overflow-x-auto pb-px [scrollbar-width:thin]">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return <li key={tab.href} className="shrink-0">
          <Link href={tab.href} aria-current={active ? "page" : undefined} className={cn("relative inline-flex min-h-11 items-center whitespace-nowrap rounded-t-lg px-3 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#1974E2]/55", active ? "text-[#1462C4] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[#1974E2]" : "text-[#586575] hover:bg-white hover:text-[#071127]")}>{tab.label}</Link>
        </li>;
      })}
    </ul>
  </nav>;
}
