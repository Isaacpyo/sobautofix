"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/events";
import { useExchangeHref } from "./exchange-base";

/** Back link to the exact filtered catalogue the visitor came from (remembered in sessionStorage). */
export function BackToResults() {
  const href = useExchangeHref();
  const fallback = href("/cars");
  const [target, setTarget] = useState(fallback);

  useEffect(() => {
    try {
      const remembered = sessionStorage.getItem("sob-exchange-catalogue-url");
      // Only ever follow a same-site catalogue path.
      if (remembered && remembered.startsWith(fallback) && !remembered.startsWith("//")) setTarget(remembered);
    } catch {
      // Storage unavailable: keep the unfiltered catalogue.
    }
  }, [fallback]);

  return (
    <Link href={target} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[15px] font-semibold text-[#1462C4] hover:underline">
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
