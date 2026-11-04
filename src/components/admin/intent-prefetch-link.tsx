"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePrefetchIntent } from "@/components/admin/use-prefetch-intent";

/** A `<Link>` that prefetches only on hover, focus or touch. See `usePrefetchIntent`. */
export function IntentPrefetchLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  const prefetchOnIntent = usePrefetchIntent();
  return <Link href={href} {...props} {...prefetchOnIntent(href)} />;
}
