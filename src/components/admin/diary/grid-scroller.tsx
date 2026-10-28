"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll container for the day and week timetables. Opens scrolled to the
 * first entry (or the morning) so a full 24-hour day does not start at
 * midnight. Instant scroll, so it respects reduced-motion preferences.
 */
export function GridScroller({ initialTop, label, className, children }: { initialTop: number; label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = Math.max(0, initialTop);
  }, [initialTop]);
  return (
    <div ref={ref} role="region" aria-label={label} tabIndex={0} className={className}>
      {children}
    </div>
  );
}
