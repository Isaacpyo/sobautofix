"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ExchangeTab = { href: string; label: string };

const tabClass = "relative inline-flex min-h-11 items-center whitespace-nowrap rounded-t-lg px-3 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#1974E2]/55";
const activeClass = "text-[#1462C4] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[#1974E2]";
const idleClass = "text-[#586575] hover:bg-white hover:text-[#071127]";

// Day-to-day sections sit in the row; owner and manager pages (reporting,
// settings) sit under More, which stays pinned at the end of the row so it
// is visible even when the row scrolls on narrow screens.
export function ExchangeSubtabNav({ tabs, moreTabs = [] }: { tabs: ExchangeTab[]; moreTabs?: ExchangeTab[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const activeHref = [...tabs, ...moreTabs].filter((tab) => tab.href === "/admin/exchange" ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>("[aria-current='page']");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeHref]);

  return <nav aria-label="Vehicle Buying & Selling sections" className="relative -mx-5 mt-4 flex items-end border-b border-[#E4EAF0] px-5 lg:mx-0 lg:px-0">
    <ul ref={listRef} className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-px [scrollbar-width:thin]">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return <li key={tab.href} className="shrink-0">
          <Link href={tab.href} aria-current={active ? "page" : undefined} className={cn(tabClass, active ? activeClass : idleClass)}>{tab.label}</Link>
        </li>;
      })}
    </ul>
    {moreTabs.length > 0 && <MoreTab tabs={moreTabs} activeHref={activeHref} />}
  </nav>;
}

function MoreTab({ tabs, activeHref }: { tabs: ExchangeTab[]; activeHref?: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const activeItem = tabs.find((tab) => tab.href === activeHref);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return <div ref={wrapperRef} className="relative shrink-0 pb-px pl-1 before:pointer-events-none before:absolute before:inset-y-0 before:-left-8 before:w-8 before:bg-gradient-to-r before:from-[#F4F7FA]/0 before:to-[#F4F7FA]" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={buttonRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)} className={cn(tabClass, "gap-1.5", activeItem ? activeClass : idleClass)}>
      More{activeItem && <span className="sr-only">, current section: {activeItem.label}</span>}
      <ChevronDown size={16} aria-hidden="true" className={cn("transition motion-reduce:transition-none", open && "rotate-180")} />
    </button>
    <div id={panelId} hidden={!open} className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-[#E4EAF0] bg-white p-1.5 shadow-[0_12px_32px_rgba(7,17,39,0.12)]">
      <ul>
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return <li key={tab.href}>
            <Link href={tab.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-lg px-3 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#1974E2]/55", active ? "bg-[#EEF5FD] text-[#1462C4]" : "text-[#26313F] hover:bg-[#F4F7FA]")}>{tab.label}</Link>
          </li>;
        })}
      </ul>
    </div>
  </div>;
}
