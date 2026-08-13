"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { AdminLoadingModal } from "@/components/admin/admin-loading-modal";

export function AdminLoadingLink({ href, children, className, target, rel, transient = false, loadingTitle, loadingDescription }: { href: string; children: React.ReactNode; className: string; target?: string; rel?: string; transient?: boolean; loadingTitle: string; loadingDescription: string }) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function beginLoading(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    setLoading(true);
    if (transient) timer.current = setTimeout(() => setLoading(false), 3000);
  }

  return <>
    <Link href={href} target={target} rel={rel} onClick={beginLoading} aria-busy={loading} className={className}>{children}</Link>
    {loading && <AdminLoadingModal title={loadingTitle} description={loadingDescription} />}
  </>;
}
