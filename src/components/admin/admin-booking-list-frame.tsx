"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";

export function AdminBookingListFrame({ children, pagination }: { children: ReactNode; pagination: ReactNode }) {
  const [loading, setLoading] = useState(false);

  function handlePaginationClick(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest("a[data-admin-pagination-link]")) setLoading(true);
  }

  return (
    <>
      <div className="relative" aria-busy={loading}>
        {children}
        {loading && (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-white/90 backdrop-blur-[1px]" role="status" aria-live="polite">
            <span className="flex items-center gap-3 rounded-xl border border-[#D7E0E9] bg-white px-5 py-4 text-sm font-extrabold text-[#1446A5] shadow-lg">
              <LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> Loading appointments…
            </span>
          </div>
        )}
      </div>
      <div onClickCapture={handlePaginationClick}>{pagination}</div>
    </>
  );
}
