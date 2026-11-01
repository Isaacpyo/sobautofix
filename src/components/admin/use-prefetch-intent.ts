"use client";

import { useState } from "react";

/**
 * Admin navigation prefetches a section only once someone shows intent
 * (hover, focus or touch). Prefetching every link on each page load fired a
 * burst of ~1.5 s server renders at once; some came back 503 and pages could
 * stall on the loading skeleton. Spread `linkProps(href)` onto a `<Link>`, or
 * use `IntentPrefetchLink` from a server component.
 */
export function usePrefetchIntent() {
  const [intent, setIntent] = useState<ReadonlySet<string>>(() => new Set());
  const show = (href: string) => setIntent((current) => current.has(href) ? current : new Set(current).add(href));
  return (href: string) => ({
    prefetch: intent.has(href) ? null : false,
    onMouseEnter: () => show(href),
    onFocus: () => show(href),
    onTouchStart: () => show(href),
  });
}
