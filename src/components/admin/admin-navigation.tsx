"use client";

import {
  BadgePoundSterling,
  Bell,
  CalendarClock,
  CarFront,
  Gauge,
  Gift,
  ImageIcon,
  Inbox,
  LogOut,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/admin/login/actions";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

type AdminLink = { href: string; label: string; icon: LucideIcon };

const navigationGroups: Array<{ label: string; links: AdminLink[] }> = [
  {
    label: "Operations",
    links: [
      { href: "/admin", label: "Dashboard", icon: Gauge },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarClock },
      { href: "/admin/invoices", label: "Invoices", icon: ReceiptText },
      { href: "/admin/inventory", label: "Vehicle stock", icon: CarFront },
    ],
  },
  {
    label: "Content",
    links: [
      { href: "/admin/news", label: "News & Blog", icon: Newspaper },
      { href: "/admin/media", label: "Media", icon: ImageIcon },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Commercial",
    links: [
      { href: "/admin/offers", label: "Offers", icon: Gift },
      { href: "/admin/pricing", label: "Pricing", icon: BadgePoundSterling },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminNavigation({ displayName, notificationCount, collapsed, onToggleCollapsed }: { displayName: string; notificationCount: number; collapsed: boolean; onToggleCollapsed: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const countLabel = notificationCount > 99 ? "99+" : String(notificationCount);

  useEffect(() => {
    if (!mobileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const navigation = (compact = false) => (
    <nav aria-label="Admin navigation" className="grid gap-6">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          {!compact && <p className="mb-2 px-3 text-[0.65rem] font-extrabold tracking-[0.16em] text-[#71839A] uppercase">{group.label}</p>}
          <div className="grid gap-1">
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={compact ? label : undefined}
                  title={compact ? label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#B8C6D6] transition hover:bg-white/[0.06] hover:text-white",
                    compact && "justify-center px-2",
                    active && "bg-[#1974E2]/18 text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[#67B9FF]",
                  )}
                >
                  <Icon size={18} className={active ? "text-[#67B9FF]" : "text-[#8FA4BC]"} aria-hidden="true" />
                  {!compact && <span>{label}</span>}
                  {href === "/admin/notifications" && notificationCount > 0 && !compact && (
                    <span className="ml-auto min-w-6 rounded-full bg-[#1974E2] px-1.5 py-0.5 text-center text-xs font-black text-white" aria-label={`${notificationCount} notifications requiring attention`}>
                      {countLabel}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const account = (compact = false) => (
    <div className="border-t border-white/10 pt-5">
      {!compact && <><p className="px-3 text-xs text-[#8F9EAF]">Signed in as</p><p className="mt-1 truncate px-3 text-sm font-bold text-white">{displayName}</p></>}
      <form action={signOut}>
        <button aria-label={compact ? "Sign out" : undefined} title={compact ? "Sign out" : undefined} className={cn("mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#C6D2DF] hover:bg-white/[0.06] hover:text-white", compact && "justify-center px-2")}>
          <LogOut size={18} aria-hidden="true" /> {!compact && "Sign out"}
        </button>
      </form>
    </div>
  );

  return (
    <>
      <aside className={cn("hidden h-screen min-h-0 flex-col bg-[#030712] text-white transition-[padding] lg:sticky lg:top-0 lg:flex", collapsed ? "p-4" : "p-5")}>
        <div className={cn("flex shrink-0 items-center", collapsed ? "justify-center" : "justify-between gap-3")}>
          {!collapsed && <div className="w-28"><Logo inverse /></div>}
          <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 text-[#DCE6F2] hover:bg-white/[0.06]">
            {collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
          </button>
        </div>
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto">{navigation(collapsed)}</div>
        <div className="mt-5 shrink-0">{account(collapsed)}</div>
      </aside>

      <div className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/10 bg-[#030712] px-4 text-white lg:hidden">
        <button
          ref={menuButton}
          type="button"
          className="grid size-10 place-items-center rounded-xl border border-white/15 text-[#DCE6F2]"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-admin-navigation"
          aria-label="Open admin menu"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <p className="font-bold">SOB Autofix CMS</p>
        {notificationCount > 0 && <span className="ml-auto rounded-full bg-[#1974E2] px-2 py-1 text-xs font-black">{countLabel}</span>}
      </div>

      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "visible pointer-events-auto" : "invisible pointer-events-none")} aria-hidden={!mobileOpen} inert={!mobileOpen}>
        <button type="button" tabIndex={-1} aria-label="Close admin menu" className={cn("absolute inset-0 bg-[#030712]/70 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} onClick={() => setMobileOpen(false)} />
        <aside id="mobile-admin-navigation" className={cn("absolute inset-y-0 left-0 flex w-[min(19rem,calc(100vw-3rem))] flex-col bg-[#030712] p-5 text-white shadow-2xl transition-transform duration-300", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex shrink-0 items-center justify-between gap-4">
            <div className="w-24"><Logo inverse /></div>
            <button type="button" className="grid size-10 place-items-center rounded-xl border border-white/15" onClick={() => setMobileOpen(false)} aria-label="Close admin menu"><X size={20} /></button>
          </div>
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">{navigation()}</div>
          <div className="mt-5 shrink-0">{account()}</div>
        </aside>
      </div>
    </>
  );
}
