"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { useConsent } from "@/components/privacy/consent-manager";
import { buttonClass } from "./ui";

/**
 * Google Maps embed for the visit section. Google sets its own cookies, so
 * the map loads only after the visitor accepts functional cookies or asks
 * for it on this page; until then a placeholder explains why.
 */
export function LocationMap({ address }: { address: string }) {
  const consent = useConsent();
  const [requested, setRequested] = useState(false);
  const show = requested || Boolean(consent?.functional);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#E3E8EF] bg-[#EEF2F6] sm:aspect-[16/9] lg:aspect-auto lg:min-h-80">
      {show ? (
        <iframe
          title={`Map showing ${address}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <MapPin size={28} aria-hidden="true" className="text-[#1462C4]" />
          <p className="max-w-xs text-[15px] leading-6 text-[#344054]">The map is provided by Google Maps, which may set cookies.</p>
          <button type="button" onClick={() => setRequested(true)} className={buttonClass("secondary", "min-h-11 px-5")}>Show map</button>
        </div>
      )}
    </div>
  );
}
