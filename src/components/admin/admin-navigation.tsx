"use client";

import {
  BadgePoundSterling,
  Bell,
  CalendarClock,
  CalendarDays,
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
  ShieldCheck,
  Star,
  Trash2,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/admin/login/actions";
import { Logo } from "@/components/layout/logo";
import { can, type ExchangePermission, type StaffRole } from "@/lib/exchange/permissions";
import { cn } from "@/lib/utils";

type AdminLink = { href: string; label: string; icon: LucideIcon; permission?: ExchangePermission };

export const navigationGroups: Array<{ label: string; links: AdminLink[] }> = [
  {
    label: "Operations",
    links: [
      { href: "/admin", label: "Dashboard", icon: Gauge },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarClock },
      { href: "/admin/diary", label: "Autofix Diary", icon: CalendarDays, permission: "diary.manage" },
      { href: "/admin/exchange", label: "Vehicle Buying & Selling", icon: CarFront, permission: "exchange.view" },
      { href: "/admin/customers", label: "Customers", icon: UsersRound, permission: "customers.view" },
      { href: "/admin/invoices", label: "Invoices", icon: ReceiptText },
      { href: "/admin/service-catalogue", label: "Service catalogue", icon: Wrench },
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
      { href: "/admin/trash", label: "Trash", icon: Trash2 },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/configuration/security", label: "Security", icon: ShieldCheck },
    ],
  },
];

type AdminNavigationProps = {
  displayName: string;
  notificationCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  role: StaffRole;
  mobileOpen: boolean;
  /** Opens or closes the drawer. `opener` gets focus back when it closes. */
  onMobileOpenChange: (open: boolean, opener?: HTMLElement | null) => void;
};

export function visibleNavigationGroups(role: StaffRole) {
  return navigationGroups.map((group) => ({ ...group, links: group.links.filter((link) => !link.permission || can(role, link.permission)) }));
}

export function AdminNavigation({ displayName, notificationCount, collapsed, onToggleCollapsed, role, mobileOpen, onMobileOpenChange }: AdminNavigationProps) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const countLabel = notificationCount > 99 ? "99+" : String(notificationCount);
  const setMobileOpen = (open: boolean) => onMobileOpenChange(open);
  const drawerClose = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    drawerClose.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onMobileOpenChange(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, onMobileOpenChange]);

  const navigation = (compact = false) => (
    <nav aria-label="Admin navigation" className="grid gap-4">
      {visibleNavigationGroups(role).map((group) => (
        <div key={group.label}>
          {!compact && <p className="mb-1.5 px-2.5 text-[0.625rem] font-extrabold tracking-[0.15em] text-[#71839A] uppercase">{group.label}</p>}
          <div className="grid gap-0.5">
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
                    "relative flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-[#B8C6D6] transition hover:bg-white/[0.06] hover:text-white",
                    compact && "justify-center px-2",
                    active && "bg-[#1974E2]/18 text-white before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-[#67B9FF]",
                  )}
                >
                  <Icon size={17} className={active ? "text-[#67B9FF]" : "text-[#8FA4BC]"} aria-hidden="true" />
                  {!compact && <span>{label}</span>}
                  {href === "/admin/notifications" && notificationCount > 0 && !compact && (
                    <span className="ml-auto min-w-5 rounded-full bg-[#1974E2] px-1.5 py-0.5 text-center text-[0.625rem] font-black text-white" aria-label={`${notificationCount} notifications requiring attention`}>
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
    <div className="border-t border-white/10 pt-4">
      {!compact && <><p className="px-2.5 text-[0.6875rem] text-[#8F9EAF]">Signed in as</p><p className="mt-0.5 truncate px-2.5 text-[0.8125rem] font-bold text-white">{displayName}</p></>}
      <form action={signOut}>
        <button aria-label={compact ? "Sign out" : undefined} title={compact ? "Sign out" : undefined} className={cn("mt-2 flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-[#C6D2DF] hover:bg-white/[0.06] hover:text-white", compact && "justify-center px-2")}>
          <LogOut size={17} aria-hidden="true" /> {!compact && "Sign out"}
        </button>
      </form>
    </div>
  );

  return (
    <>
      <aside className={cn("hidden h-screen min-h-0 flex-col bg-[#030712] text-white transition-[padding] lg:sticky lg:top-0 lg:flex", collapsed ? "p-3" : "p-4")}>
        <div className={cn("flex shrink-0 items-center", collapsed ? "justify-center" : "justify-between gap-3")}>
          {!collapsed && <div className="w-24"><Logo inverse /></div>}
          <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 text-[#DCE6F2] hover:bg-white/[0.06]">
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{navigation(collapsed)}</div>
        <div className="mt-4 shrink-0">{account(collapsed)}</div>
      </aside>

      <div className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/10 bg-[#030712] px-4 text-white lg:hidden">
        <button
          ref={menuButton}
          type="button"
          className="grid size-10 place-items-center rounded-xl border border-white/15 text-[#DCE6F2]"
          onClick={() => onMobileOpenChange(true, menuButton.current)}
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
        <aside id="mobile-admin-navigation" className={cn("absolute inset-y-0 left-0 flex w-[min(17rem,calc(100vw-3rem))] flex-col bg-[#030712] p-4 text-white shadow-2xl transition-transform duration-300", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex shrink-0 items-center justify-between gap-4">
            <div className="w-24"><Logo inverse /></div>
            <button ref={drawerClose} type="button" className="grid size-11 place-items-center rounded-xl border border-white/15" onClick={() => setMobileOpen(false)} aria-label="Close admin menu"><X size={20} aria-hidden="true" /></button>
          </div>
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">{navigation()}</div>
          <div className="mt-4 shrink-0">{account()}</div>
        </aside>
      </div>
    </>
  );
}
