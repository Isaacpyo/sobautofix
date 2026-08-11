"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { vehicleFeatureGroups } from "@/lib/sales/vehicle-features";

export function VehicleFeatureSelector({ defaultValue = [] }: { defaultValue?: string[] }) {
  const [selected, setSelected] = useState(() => [...new Set(defaultValue.filter(Boolean))]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const groups = useMemo(() => vehicleFeatureGroups.map((group) => ({
    ...group,
    features: group.features.filter((feature) => !selected.includes(feature) && feature.toLowerCase().includes(normalizedQuery)),
  })).filter((group) => group.features.length), [normalizedQuery, selected]);
  const exactMatch = vehicleFeatureGroups.some((group) => group.features.some((feature) => feature.toLowerCase() === normalizedQuery)) || selected.some((feature) => feature.toLowerCase() === normalizedQuery);

  function add(feature: string) {
    const clean = feature.trim();
    if (!clean || selected.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    setSelected((current) => [...current, clean]);
    setQuery("");
    setOpen(true);
  }

  return <div>
    <label htmlFor={`${listId}-search`} className="block text-sm font-bold text-[#071127]">Features</label>
    <p className="mt-1 text-xs leading-5 text-[#667586]">Search and select every feature you have physically verified on this vehicle.</p>
    <input type="hidden" name="features" value={selected.join("\n")} />
    <div className="mt-3 flex min-h-12 flex-wrap gap-2 rounded-xl border border-[#D7E0E9] bg-white p-2 focus-within:border-[#1974E2]">
      {selected.map((feature) => <span key={feature} className="inline-flex items-center gap-1 rounded-full bg-[#EAF3FF] px-3 py-2 text-sm font-bold text-[#1446A5]">{feature}<button type="button" onClick={() => setSelected((current) => current.filter((item) => item !== feature))} aria-label={`Remove ${feature}`} className="grid size-6 place-items-center rounded-full hover:bg-white"><X size={14} /></button></span>)}
      <label className="flex min-w-[210px] flex-1 items-center gap-2 px-2 text-sm text-[#667586]" htmlFor={`${listId}-search`}><Search size={17} /><input id={`${listId}-search`} role="combobox" aria-expanded={open} aria-controls={listId} autoComplete="off" value={query} onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && query.trim()) { event.preventDefault(); const first = groups[0]?.features[0]; add(first || query); } }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder={selected.length ? "Add another feature" : "Search features, e.g. parking sensors"} className="min-h-10 flex-1 bg-transparent outline-none" /></label>
    </div>
    {open && <div id={listId} role="listbox" aria-label="Available vehicle features" className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-[#D7E0E9] bg-white p-2 shadow-lg">
      {groups.map((group) => <section key={group.label}><h4 className="sticky top-0 bg-white px-3 py-2 text-xs font-extrabold tracking-wide text-[#667586] uppercase">{group.label}</h4>{group.features.map((feature) => <button key={feature} type="button" role="option" aria-selected="false" onClick={() => add(feature)} className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-semibold text-[#071127] hover:bg-[#F4F7FA]"><span>{feature}</span><Plus size={16} className="text-[#1974E2]" /></button>)}</section>)}
      {!groups.length && query.trim() && !exactMatch && <button type="button" onClick={() => add(query)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-[#1974E2] hover:bg-[#F4F7FA]"><Plus size={16} />Add “{query.trim()}”</button>}
      {!groups.length && (!query.trim() || exactMatch) && <p className="px-3 py-4 text-sm text-[#667586]"><Check size={16} className="mr-2 inline" />No more matching features.</p>}
      <button type="button" onClick={() => setOpen(false)} className="sticky bottom-0 mt-2 min-h-10 w-full rounded-lg bg-[#F4F7FA] text-sm font-bold text-[#334155]">Done</button>
    </div>}
  </div>;
}
