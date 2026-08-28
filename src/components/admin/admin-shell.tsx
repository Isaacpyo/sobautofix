"use client";

import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { NotificationMenu } from "@/components/admin/notification-menu";

type AdminShellProps = {
  children: React.ReactNode;
  displayName: string;
  notificationCount: number;
};

export function AdminShell({ children, displayName, notificationCount }: AdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  function searchAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("admin-search") || "").trim().toLowerCase();
    if (!query) return;

    const destinations = [
      ["dashboard home", "/admin"], ["enquiries messages", "/admin/enquiries"],
      ["vehicle stock inventory cars", "/admin/inventory"], ["news blog articles", "/admin/news"],
      ["media images", "/admin/media"], ["reviews", "/admin/reviews"],
      ["offers", "/admin/offers"], ["pricing prices", "/admin/pricing"],
      ["notifications alerts", "/admin/notifications"], ["settings configuration", "/admin/settings"],
      ["security mfa two factor authenticator", "/admin/configuration/security"],
    ] as const;
    const match = destinations.find(([terms]) => terms.includes(query));
    if (match) router.push(match[1]);
  }

  function refreshPage() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className={`min-h-screen bg-[#F4F7FA] lg:grid ${sidebarCollapsed ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[232px_minmax(0,1fr)]"}`}>
      <AdminNavigation displayName={displayName} notificationCount={notificationCount} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} />
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
                  {['Dashboard', 'Enquiries', 'Vehicle stock', 'News & Blog', 'Media', 'Reviews', 'Offers', 'Pricing', 'Notifications', 'Settings', 'Security'].map((option) => <option key={option} value={option} />)}
                </datalist>
              </form>
            </div>
            <div className="ml-auto flex items-center gap-3 sm:gap-4">
              <button type="button" onClick={refreshPage} aria-label="Refresh admin data" title="Refresh" className="grid h-10 w-10 place-items-center rounded-full border border-[#D7E0E9] text-[#071127] transition-colors hover:border-[#1974E2] hover:text-[#1974E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1974E2]">
                <RefreshCw size={18} className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
              </button>
              <NotificationMenu notificationCount={notificationCount} />
              <Link href="/" className="whitespace-nowrap text-sm font-bold text-[#1974E2]">View website ↗</Link>
            </div>
          </div>
        </header>
        <main className="min-w-0 p-5 lg:p-8 xl:p-10">{children}</main>
      </div>
    </div>
  );
}
