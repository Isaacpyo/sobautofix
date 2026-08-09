"use client";

import { Check, ChevronRight, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { track } from "@/lib/analytics/events";
import { formatRegistration, normalizeRegistration } from "@/lib/vehicle/registration-format";
import type { VehicleDetails } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVehicleSession } from "./vehicle-context";

const problems = [
  ["warning-light", "Warning light is on", "car-diagnostics"],
  ["electrical", "Electrical equipment isn't working", "electrical-fault-finding"],
  ["wont-start", "Car won't start", "battery-charging"],
  ["lost-power", "Car has lost power", "engine-repair"],
  ["brakes", "Braking problem", "brake-repair"],
  ["battery", "Battery keeps going flat", "battery-charging"],
  ["servicing", "Servicing", "vehicle-servicing"],
  ["other", "Something else", "car-diagnostics"],
] as const;

type State = "input" | "loading" | "confirm" | "problem" | "manual";

export function VehicleJourney({ compact = false, source = "website", heading = "Enter your registration" }: { compact?: boolean; source?: string; heading?: string }) {
  const { session, updateSession, clearVehicle } = useVehicleSession();
  const [registration, setRegistration] = useState("");
  const [state, setState] = useState<State>(session.vehicle ? "problem" : "input");
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(session.vehicle);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeRegistration(registration);
    if (normalized.length < 2 || normalized.length > 8) {
      setError("Enter a valid UK registration.");
      return;
    }
    setError("");
    setState("loading");
    track("vehicle_lookup_started", { source });
    try {
      const response = await fetch("/api/vehicle/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration: normalized }) });
      const result = await response.json() as { success: boolean; vehicle?: VehicleDetails; error?: { message: string } };
      if (!response.ok || !result.success || !result.vehicle) throw new Error(result.error?.message || "We couldn't identify that vehicle.");
      setVehicle(result.vehicle);
      setState("confirm");
      track("vehicle_lookup_success", { source });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vehicle lookup is unavailable.");
      setState("manual");
      track("vehicle_lookup_failed", { source });
    }
  }

  function confirm() {
    if (!vehicle) return;
    updateSession({ vehicle, source });
    setState("problem");
  }

  function selectProblem(problem: string, service: string) {
    updateSession({ vehicle, selectedProblem: problem, selectedService: service, source });
    track("problem_selected", { source, selection: problem });
  }

  const shell = compact ? "rounded-2xl border border-[#1974E2]/35 bg-[#071127]/90 p-5 shadow-2xl" : "rounded-3xl border border-[#1974E2]/30 bg-[#071127] p-6 shadow-2xl sm:p-8";
  return (
    <div className={shell}>
      {state === "input" && (
        <form onSubmit={submit}>
          <label htmlFor={`registration-${source}`} className="mb-3 block text-xs font-extrabold tracking-[.14em] text-[#67B9FF] uppercase">{heading}</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex min-h-16 flex-1 overflow-hidden rounded-xl bg-white shadow-inner focus-within:ring-4 focus-within:ring-[#168BFF]/20">
              <span className="plate-strip grid w-12 place-items-center text-xs font-bold text-white">GB</span>
              <input id={`registration-${source}`} value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())} className="min-w-0 flex-1 border-0 bg-white px-4 font-mono text-xl font-black tracking-[.14em] text-black outline-none" placeholder="AB12 CDE" autoComplete="off" maxLength={9} aria-describedby={error ? `registration-error-${source}` : undefined} />
            </div>
            <Button type="submit" className="min-h-16 px-7"><Search size={19} /> Find my vehicle</Button>
          </div>
          {error && <p id={`registration-error-${source}`} className="mt-3 text-sm text-red-300">{error}</p>}
          <p className="mt-3 text-xs text-[#8F9EAF]">Your registration stays out of page URLs and analytics.</p>
        </form>
      )}
      {state === "loading" && <div className="flex min-h-32 items-center justify-center gap-3 text-white"><LoaderCircle className="animate-spin text-[#168BFF]" /> Finding your vehicle…</div>}
      {state === "confirm" && vehicle && (
        <div className="text-white">
          <p className="flex items-center gap-2 text-xs font-extrabold tracking-[.14em] text-[#67B9FF] uppercase"><Check size={16} /> Vehicle identified</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
            <div><h3 className="text-3xl font-extrabold uppercase">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle found"}</h3><p className="mt-1 text-[#C6D2DF]">{[vehicle.year, vehicle.fuelType, vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc} cc` : undefined].filter(Boolean).join(" · ")}</p><span className="mt-4 inline-block rounded-lg bg-white px-4 py-2 font-mono text-lg font-black tracking-[.14em] text-black">{formatRegistration(vehicle.registration)}</span></div>
            <div className="grid gap-2"><Button onClick={confirm}>Yes, that&apos;s my vehicle <ChevronRight size={18} /></Button><button className="text-sm text-[#9AA7B6] underline" onClick={() => { setState("input"); setVehicle(null); }}>Not your vehicle?</button></div>
          </div>
        </div>
      )}
      {state === "manual" && (
        <div className="text-white">
          <div className="flex gap-3"><TriangleAlert className="shrink-0 text-amber-400" /><div><h3 className="text-xl font-bold">We couldn&apos;t confirm that vehicle</h3><p className="mt-1 text-sm leading-6 text-[#C6D2DF]">You can continue without lookup and add the details to your request.</p></div></div>
          <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => { const manual = { registration: normalizeRegistration(registration) }; setVehicle(manual); updateSession({ vehicle: manual, source }); setState("problem"); }}>Continue manually</Button><Button variant="secondary" onClick={() => setState("input")}>Try again</Button></div>
        </div>
      )}
      {state === "problem" && (
        <div className="text-white">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-extrabold tracking-[.14em] text-[#67B9FF] uppercase">Vehicle ready</p><h3 className="mt-1 text-2xl font-bold">What can we help with?</h3></div><button className="text-sm text-[#9AA7B6] underline" onClick={() => { clearVehicle(); setVehicle(null); setState("input"); }}>Change vehicle</button></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">{problems.map(([value, label, service]) => <Link key={value} onClick={() => selectProblem(value, service)} href="/book" className={cn("flex min-h-12 items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold transition", session.selectedProblem === value ? "border-[#168BFF] bg-[#1974E2]/20" : "border-white/10 bg-white/5 hover:border-[#1974E2]")}>{label}<ChevronRight size={16} className="text-[#67B9FF]" /></Link>)}</div>
          <Link href="/get-a-quote" className="mt-4 inline-block text-sm font-bold text-[#67B9FF] hover:underline">Prefer a quote request? Continue here →</Link>
        </div>
      )}
    </div>
  );
}
