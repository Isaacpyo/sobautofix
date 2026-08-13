"use client";

import { useState } from "react";
import { openingTimeOptions, parseOpeningHours } from "@/lib/settings/opening-hours";

type TimeRange = { open: string; close: string };

export function OpeningHoursEditor({ initialHours }: { initialHours: Record<string, string> }) {
  const [hours, setHours] = useState<Record<string, TimeRange>>(() => Object.fromEntries(
    Object.entries(initialHours).map(([day, value]) => [day, parseOpeningHours(value)]),
  ));
  const [all, setAll] = useState<TimeRange>({ open: "", close: "" });
  const canApply = Boolean((all.open && all.close) || (!all.open && !all.close));

  function applyToAll() {
    if (!canApply) return;
    setHours((current) => Object.fromEntries(Object.keys(current).map((day) => [day, { ...all }])));
  }

  return <div className="grid gap-5 md:col-span-2 md:grid-cols-2">
    <fieldset className="grid gap-4 rounded-xl border border-[#BCD6F6] bg-[#F1F7FF] p-4 md:col-span-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <legend className="px-1 text-sm font-extrabold text-[#1446A5]">Set all days</legend>
      <TimeSelect label="Open" value={all.open} onChange={(open) => setAll((current) => ({ ...current, open }))} />
      <TimeSelect label="Close" value={all.close} onChange={(close) => setAll((current) => ({ ...current, close }))} />
      <button type="button" disabled={!canApply} onClick={applyToAll} className="min-h-11 rounded-xl bg-[#1446A5] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Apply to all</button>
      {!canApply && <p className="text-xs font-semibold text-amber-800 md:col-span-3">Choose both times, or leave both as Not set.</p>}
    </fieldset>

    {Object.entries(hours).map(([day, range]) => <fieldset key={day} className="grid grid-cols-2 gap-3">
      <legend className="mb-2 text-sm font-bold text-[#071127]">{day === "bankHolidays" ? "Bank holidays" : day.charAt(0).toUpperCase() + day.slice(1)}</legend>
      <TimeSelect label="Open" name={`${day}Open`} value={range.open} onChange={(open) => setHours((current) => ({ ...current, [day]: { ...(current[day] || { open: "", close: "" }), open } }))} />
      <TimeSelect label="Close" name={`${day}Close`} value={range.close} onChange={(close) => setHours((current) => ({ ...current, [day]: { ...(current[day] || { open: "", close: "" }), close } }))} />
    </fieldset>)}
  </div>;
}

function TimeSelect({ label, name, value, onChange }: { label: string; name?: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-[#667586]">{label}<select aria-label={name ? `${name} time` : `All days ${label.toLowerCase()} time`} name={name} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full"><option value="">Not set</option>{openingTimeOptions.map((time) => <option key={time} value={time}>{time}</option>)}</select></label>;
}
