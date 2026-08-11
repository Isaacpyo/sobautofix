"use client";

import { Bell, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export function NotificationMenu({ notificationCount }: { notificationCount: number }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const countLabel = notificationCount > 99 ? "99+" : String(notificationCount);
  const buttonLabel = notificationCount > 0
    ? `${notificationCount} notifications requiring attention`
    : "Notification centre";

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-[#D7E0E9] text-[#071127] transition-colors hover:border-[#1974E2] hover:text-[#1974E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1974E2]"
      >
        <Bell size={19} aria-hidden="true" />
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 py-0.5 text-center text-[10px] font-black leading-4 text-white" aria-hidden="true">
            {countLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#D7E0E9] bg-white shadow-[0_18px_50px_rgba(7,17,39,0.16)]"
        >
          <div className="flex items-center justify-between border-b border-[#E4EAF0] px-5 py-4">
            <div>
              <p className="font-extrabold text-[#071127]">Notifications</p>
              <p className="mt-0.5 text-xs text-[#657283]">Admin activity requiring attention</p>
            </div>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full text-[#657283] hover:bg-[#F4F7FA] hover:text-[#071127]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="p-5">
            {notificationCount > 0 ? (
              <div className="flex gap-3 rounded-xl bg-red-50 p-4">
                <span className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">
                  <Bell size={17} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-[#071127]">{notificationCount} {notificationCount === 1 ? "item needs" : "items need"} attention</p>
                  <p className="mt-1 text-sm leading-5 text-[#586575]">Review new enquiries and any email delivery issues.</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 rounded-xl bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={21} aria-hidden="true" />
                <div>
                  <p className="font-bold text-[#071127]">You’re all caught up</p>
                  <p className="mt-1 text-sm leading-5 text-[#586575]">There are no notifications requiring attention.</p>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/admin/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-[#E4EAF0] px-5 py-3.5 text-center text-sm font-extrabold text-[#1974E2] hover:bg-[#F8FAFC]"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
