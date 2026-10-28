"use client";

import { CalendarDays, CarFront, Menu, Plus, Sun, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { MobileQuickActions } from "@/components/admin/mobile-quick-actions";
import { can, type StaffRole } from "@/lib/exchange/permissions";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (pathname: string) => boolean };

const startsWith = (prefix: string) => (pathname: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Left and right of the raised New button. Staff without customers.view get Vehicles instead of Customers. */
export function bottomNavItems(role: StaffRole): { left: NavItem[]; right: NavItem } {
  const right: NavItem = can(role, "customers.view")
    ? { href: "/admin/customers", label: "Customers", icon: UsersRound, match: startsWith("/admin/customers") }
    : { href: "/admin/exchange", label: "Vehicles", icon: CarFront, match: startsWith("/admin/exchange") };
  return {
    left: [
      { href: "/admin/today", label: "Today", icon: Sun, match: startsWith("/admin/today") },
      { href: "/admin/diary", label: "Diary", icon: CalendarDays, match: startsWith("/admin/diary") },
    ],
    right,
  };
}

const itemClass = "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] leading-tight font-semibold focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[rgba(22,139,255,.55)]";

/**
 * Admin bottom navigation below the lg breakpoint: Today, Diary, a raised New
 * button, Customers and More (which opens the existing drawer menu).
 */
export function MobileBottomNav({ role, menuOpen, onOpenMenu }: { role: StaffRole; menuOpen: boolean; onOpenMenu: (opener: HTMLElement | null) => void }) {
  const pathname = usePathname() || "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const { left, right } = bottomNavItems(role);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    newButton.current?.focus();
  }, []);

  const link = (item: NavItem) => {
    const active = item.match(pathname);
    const Icon = item.icon;
    return (
      <li key={item.href} className="flex justify-center">
        <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(itemClass, "w-full", active ? "text-[#1462C4]" : "text-[#5B6575] hover:text-[#0B1220]")}>
          <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E3E8EF] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(11,18,32,.06)] lg:hidden">
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5 items-center px-1">
          {left.map(link)}
          <li className="flex justify-center">
            <button
              ref={newButton}
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              aria-label="New: create an appointment, listing or enquiry"
              className="group -mt-8 flex flex-col items-center gap-1 rounded-2xl px-1 text-[11px] leading-tight font-semibold text-[#0B1220] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]"
            >
              <span className="grid size-14 place-items-center rounded-full bg-[#1974E2] text-white shadow-[0_8px_20px_rgba(25,116,226,.4)] ring-4 ring-white transition group-hover:bg-[#1462C4]">
                <Plus size={28} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span>New</span>
            </button>
          </li>
          {link(right)}
          <li className="flex justify-center">
            <button
              ref={moreButton}
              type="button"
              onClick={() => onOpenMenu(moreButton.current)}
              aria-expanded={menuOpen}
              aria-controls="mobile-admin-navigation"
              aria-label="More: open the full admin menu"
              className={cn(itemClass, "w-full", menuOpen ? "text-[#1462C4]" : "text-[#5B6575] hover:text-[#0B1220]")}
            >
              <Menu size={22} aria-hidden="true" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
      <MobileQuickActions role={role} open={sheetOpen} onClose={closeSheet} />
    </>
  );
}
