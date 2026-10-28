"use client";

import { ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/events";
import { readRememberedCatalogue, requestCatalogueRestore } from "./catalogue-filters";
import { useExchangeHref } from "./exchange-base";
import { useToast } from "./feedback";

/** Back link to the exact filtered catalogue the visitor came from (remembered in sessionStorage). */
export function BackToResults() {
  const href = useExchangeHref();
  const fallback = href("/cars");
  const [target, setTarget] = useState(fallback);

  useEffect(() => {
    // Only ever follow a same-site catalogue path.
    setTarget(readRememberedCatalogue(fallback));
  }, [fallback]);

  return (
    <Link href={target} scroll={false} onClick={() => requestCatalogueRestore(target)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[15px] font-semibold text-[#1462C4] hover:underline">
      <ArrowLeft size={18} aria-hidden="true" /> Back to results
    </Link>
  );
}

/** Records a vehicle page view without personal data. */
export function TrackVehicleView({ status, condition }: { status: string; condition: string }) {
  useEffect(() => {
    track("exchange_vehicle_viewed", { status, condition });
  }, [status, condition]);
  return null;
}

/** Share the page with the phone's share sheet, or copy the link. */
export function ShareLink({ title }: { title: string }) {
  const toast = useToast();
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast("Could not copy the link. Copy it from the address bar instead.", "info");
    }
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[15px] font-semibold text-[#344054] hover:bg-[#F3F5F8] active:bg-[#E3E8EF]">
      <Share2 size={18} aria-hidden="true" /> Share
    </button>
  );
}
