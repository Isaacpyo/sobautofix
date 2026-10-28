"use client";

import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { MobileBottomNav } from "@/components/admin/mobile-bottom-nav";
import { NotificationMenu } from "@/components/admin/notification-menu";
import type { StaffRole } from "@/lib/exchange/permissions";

type AdminShellProps = {
  children: React.ReactNode;
  displayName: string;
  notificationCount: number;
  /** Staff role from the server; controls which links and quick actions are shown. */
  role?: StaffRole;
};

/** Admin search: typed words matched against these terms, first match wins. */
export const adminSearchDestinations = [
  ["dashboard home", "/admin"], ["today agenda my day", "/admin/today"],
  ["autofix diary calendar appointments viewings schedule", "/admin/diary"],
  ["vehicle buying selling exchange", "/admin/exchange"],
  ["vehicle stock inventory cars", "/admin/exchange/stock"],
  ["customers contacts people", "/admin/customers"],
  ["enquiries messages", "/admin/enquiries"], ["bookings workshop", "/admin/bookings"],
  ["news blog articles", "/admin/news"],
  ["media images", "/admin/media"], ["reviews", "/admin/reviews"],
  ["offers", "/admin/offers"], ["pricing prices", "/admin/pricing"],
  ["notifications alerts", "/admin/notifications"], ["settings configuration", "/admin/settings"],
  ["security mfa two factor authenticator", "/admin/configuration/security"],
] as const;

export const adminSearchOptions = ["Dashboard", "Today", "Autofix Diary", "Vehicle Buying & Selling", "Vehicle stock", "Customers", "Enquiries", "Bookings", "News & Blog", "Media", "Reviews", "Offers", "Pricing", "Notifications", "Settings", "Security"];

export function findAdminSearchDestination(input: string) {
  const query = input.trim().toLowerCase().replace(/&/g, " ").replace(/\s+/g, " ").trim();
  if (!query) return null;
  const words = query.split(" ");
  const match = adminSearchDestinations.find(([terms]) => terms.includes(query))
    ?? adminSearchDestinations.find(([terms]) => words.every((word) => terms.split(" ").includes(word)));
  return match ? match[1] : null;
}

export function AdminShell({ children, displayName, notificationCount, role = "owner" }: AdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuOpener = useRef<HTMLElement | null>(null);
  const changeMobileMenu = useCallback((open: boolean, opener?: HTMLElement | null) => {
    if (open) {
      menuOpener.current = opener ?? null;
      setMobileMenuOpen(true);
      return;
    }
    setMobileMenuOpen(false);
    menuOpener.current?.focus();
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  const [liveNotificationCount, setLiveNotificationCount] = useState(notificationCount);
  const [serverNotificationCount, setServerNotificationCount] = useState(notificationCount);
  const notificationCountRef = useRef(notificationCount);
  const router = useRouter();
  const pathname = usePathname();

  if (serverNotificationCount !== notificationCount) {
    setServerNotificationCount(notificationCount);
    setLiveNotificationCount(notificationCount);
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshNotificationCount() {
      try {
        const response = await fetch("/api/admin/notifications/count", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { count?: unknown };
        if (cancelled || typeof payload.count !== "number" || payload.count === notificationCountRef.current) return;
        notificationCountRef.current = payload.count;
        setLiveNotificationCount(payload.count);
        router.refresh();
      } catch {
        // Keep the last known count; the manual refresh remains available.
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshNotificationCount();
    }

    void refreshNotificationCount();
    const timer = window.setInterval(() => { void refreshNotificationCount(); }, 20_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname, router]);

  function searchAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const destination = findAdminSearchDestination(String(form.get("admin-search") || ""));
    if (destination) router.push(destination);
  }

  function refreshPage() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className={`min-h-screen bg-[#F4F7FA] lg:grid ${sidebarCollapsed ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[232px_minmax(0,1fr)]"}`}>
      <AdminNavigation displayName={displayName} notificationCount={liveNotificationCount} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} role={role} mobileOpen={mobileMenuOpen} onMobileOpenChange={changeMobileMenu} />
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#E4EAF0] bg-white px-5 py-3 lg:px-8 xl:px-10">
          <div className="flex items-center justify-between gap-4">
            <div className="hidden min-w-0 items-center gap-4 sm:flex">
              <p className="shrink-0 text-sm font-bold text-[#071127]">SOB Autofix CMS</p>
              <form onSubmit={searchAdmin} role="search" className="relative w-[clamp(20rem,32vw,34rem)]">
                <label htmlFor="admin-search" className="sr-only">Search admin sections</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" size={17} aria-hidden="true" />
                <input id="admin-search" name="admin-search" list="admin-search-options" placeholder="Search admin…" autoComplete="off" className="h-10 w-full rounded-xl border border-[#D7E0E9] bg-[#F8FAFC] pl-10 pr-3 text-sm text-[#071127] outline-none placeholder:text-[#8794A3] focus:border-[#1974E2] focus:bg-white" />
                <datalist id="admin-search-options">
                  {adminSearchOptions.map((option) => <option key={option} value={option} />)}
                </datalist>
              </form>
            </div>
            <div className="ml-auto flex items-center gap-3 sm:gap-4">
              <button type="button" onClick={refreshPage} aria-label="Refresh admin data" title="Refresh" className="grid h-10 w-10 place-items-center rounded-full border border-[#D7E0E9] text-[#071127] transition-colors hover:border-[#1974E2] hover:text-[#1974E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1974E2]">
                <RefreshCw size={18} className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
              </button>
              <NotificationMenu notificationCount={liveNotificationCount} />
              <Link href="/" className="whitespace-nowrap text-sm font-bold text-[#1974E2]">View website ↗</Link>
            </div>
          </div>
        </header>
        <main className="min-w-0 p-5 pb-[calc(64px_+_env(safe-area-inset-bottom)_+_16px)] lg:p-8 xl:p-10">{children}</main>
      </div>
      <MobileBottomNav role={role} menuOpen={mobileMenuOpen} onOpenMenu={(opener) => changeMobileMenu(true, opener)} />
    </div>
  );
}
