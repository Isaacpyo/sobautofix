"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useState } from "react";
import coverageMap from "../../../assets/coverage-map-south-yorkshire.jpg";

const locations = [
  { name: "Stainforth", left: "45%", top: "42%" },
  { name: "Adwick-le-Street", left: "43%", top: "46%" },
  { name: "Conisbrough", left: "65%", top: "40%" },
  { name: "Bawtry", left: "81%", top: "38%" },
  { name: "Doncaster", left: "61%", top: "47%", primary: true },
  { name: "Rotherham", left: "46%", top: "51%" },
  { name: "Bentley", left: "51%", top: "55%" },
  { name: "Mexborough", left: "45%", top: "59%" },
  { name: "Sheffield", left: "37%", top: "59%" },
  { name: "Barnsley", left: "37%", top: "64%" },
];

export function HomeCoverageMap({ expanded = false, doncasterOnly = false, variant = "light" }: { expanded?: boolean; doncasterOnly?: boolean; variant?: "light" | "dark" }) {
  const [selected, setSelected] = useState("Doncaster");
  const selectedLocation = locations.find((location) => location.name === selected);
  const displayedLocations = doncasterOnly ? locations.filter((location) => location.name === "Doncaster") : locations;
  const isDark = variant === "dark";

  return (
    <div className={`overflow-hidden rounded-2xl border ${isDark ? "border-[#67B9FF]/25 bg-[#061027] shadow-none" : "border-[#D7E0E9] bg-[#EAF3FF] shadow-[0_18px_45px_rgba(7,17,39,.1)]"}`}>
      <div className={`relative isolate aspect-square overflow-hidden ${isDark ? "bg-[radial-gradient(circle_at_52%_44%,#164b80_0%,#0A2543_50%,#061027_100%)]" : "bg-[radial-gradient(circle_at_52%_44%,#fff_0%,#EAF3FF_52%,#DCEBFA_100%)]"}`}>
        <Image
          src={coverageMap}
          alt="Map of the SOB Autofix service area around Doncaster and South Yorkshire"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={`object-cover ${isDark ? "opacity-95" : "opacity-90"}`}
          priority={doncasterOnly}
        />
        <div
          className={`absolute inset-0 ${isDark ? "opacity-35" : "opacity-55"}`}
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(25,116,226,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(25,116,226,.16) 1px, transparent 1px)",
            backgroundSize: "3rem 3rem",
            maskImage: "radial-gradient(ellipse 48% 42% at 55% 51%, black 20%, transparent 78%)",
          }}
        />
        <div className="absolute inset-[9%] rounded-[44%_56%_48%_52%/52%_42%_58%_48%] border border-[#1974E2]/25 bg-[#1974E2]/8 shadow-[inset_0_0_5rem_rgba(25,116,226,.1)]" aria-hidden="true" />
        {displayedLocations.map((location) => (
          <button key={location.name} type="button" onClick={() => setSelected(location.name)} className={`absolute z-10 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/35 ${selected === location.name ? "bg-[#1974E2] text-white ring-4 ring-[#1974E2]/25" : "bg-[#071127]/80 text-[#67B9FF]"}`} style={{ left: location.left, top: location.top }} aria-label={`Select ${location.name}`} aria-pressed={selected === location.name}>
            <MapPin size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
      {!doncasterOnly && <div className="border-t border-[#C8D9EA] bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-bold text-[#071127]"><MapPin size={17} className="text-[#1974E2]" aria-hidden="true" />{selected} service area</p>
          <Link href={selected === "Doncaster" ? "/areas/doncaster" : "/contact"} className="text-sm font-bold text-[#1974E2] hover:text-[#1446A5]">Ask about availability →</Link>
        </div>
        {expanded && <div className="mt-4 border-t border-[#E4EAF0] pt-4"><div className="flex flex-wrap gap-2" aria-label="Choose a coverage area">{locations.map((location) => <button key={location.name} type="button" onClick={() => setSelected(location.name)} className={`rounded-full border px-3 py-2 text-sm font-bold transition ${selected === location.name ? "border-[#1974E2] bg-[#1974E2] text-white" : "border-[#D7E0E9] bg-white text-[#334155] hover:border-[#1974E2] hover:text-[#1974E2]"}`}>{location.name}</button>)}</div><div className="mt-4 flex flex-col justify-between gap-4 rounded-xl bg-[#F4F7FA] p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-[#071127]">{selectedLocation?.name} availability</p><p className="mt-1 text-sm leading-6 text-[#586575]">Workshop and mobile suitability depends on the service, vehicle condition and postcode. Share the details for confirmation.</p></div><div className="flex shrink-0 flex-wrap gap-3"><Link href="/book" className="inline-flex min-h-11 items-center rounded-lg bg-[#071127] px-4 text-sm font-bold text-white hover:bg-[#15294D]">Book appointment</Link><Link href="/contact" className="inline-flex min-h-11 items-center rounded-lg border border-[#1974E2]/25 bg-white px-4 text-sm font-bold text-[#1974E2] hover:bg-[#EAF3FF]">Request availability</Link></div></div></div>}
      </div>}
    </div>
  );
}
