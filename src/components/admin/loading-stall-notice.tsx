"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Shown inside the admin loading skeleton. If the page has not arrived after
 * `delayMs`, say so and offer a reload instead of leaving staff looking at a
 * skeleton with no explanation. The skeleton unmounts as soon as the page
 * renders, so this never appears on a page that loaded.
 */
export function LoadingStallNotice({ delayMs = 12_000 }: { delayMs?: number }) {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setStalled(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!stalled) return null;
  return (
    <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
      <p>This page is taking longer than usual to load. Reloading usually fixes it.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1974E2] px-4 font-bold text-white hover:bg-[#1462C4]"
      >
        <RotateCw size={16} aria-hidden="true" />
        Reload page
      </button>
    </div>
  );
}
