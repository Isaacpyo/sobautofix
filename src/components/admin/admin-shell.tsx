import { Bell } from "lucide-react";
import Link from "next/link";
import { AdminNavigation } from "@/components/admin/admin-navigation";

type AdminShellProps = {
  children: React.ReactNode;
  displayName: string;
  notificationCount: number;
};

export function AdminShell({ children, displayName, notificationCount }: AdminShellProps) {
  const countLabel = notificationCount > 99 ? "99+" : String(notificationCount);

  return (
    <div className="min-h-screen bg-[#F4F7FA] lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <AdminNavigation displayName={displayName} notificationCount={notificationCount} />
      <div className="min-w-0">
        <header className="border-b border-[#E4EAF0] bg-white px-5 py-3 lg:px-8 xl:px-10">
          <div className="flex items-center justify-between gap-4">
            <p className="hidden text-sm font-bold text-[#071127] sm:block">SOB Autofix CMS</p>
            <div className="ml-auto flex items-center gap-3 sm:gap-4">
              <Link
                href="/admin/notifications"
                aria-label={notificationCount > 0 ? `${notificationCount} notifications requiring attention` : "Notification centre"}
                className="relative grid h-10 w-10 place-items-center rounded-full border border-[#D7E0E9] text-[#071127] hover:border-[#1974E2] hover:text-[#1974E2]"
              >
                <Bell size={19} aria-hidden="true" />
                {notificationCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-red-600 px-1 py-0.5 text-center text-[10px] leading-4 font-black text-white" aria-hidden="true">{countLabel}</span>}
              </Link>
              <Link href="/" className="whitespace-nowrap text-sm font-bold text-[#1974E2]">View website ↗</Link>
            </div>
          </div>
        </header>
        <main className="min-w-0 p-5 lg:p-8 xl:p-10">{children}</main>
      </div>
    </div>
  );
}
