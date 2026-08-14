"use client";

import {
  BatteryCharging,
  Check,
  ChevronRight,
  Disc3,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { track } from "@/lib/analytics/events";
import { formatRegistration, normalizeRegistration } from "@/lib/vehicle/registration-format";
import type { VehicleDetails } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { ContextualServiceImage, type ContextualImageId } from "@/components/marketing/contextual-service-image";
import { cn } from "@/lib/utils";
import { useVehicleSession } from "./vehicle-context";

type ServiceOption = {
  value: string;
  label: string;
  service: string;
  icon: LucideIcon;
};

const serviceOptions: ServiceOption[] = [
  { value: "diagnostics", label: "Vehicle Diagnostics", service: "vehicle-diagnostics", icon: Search },
  { value: "electrical", label: "Electrical Fault Finding", service: "electrical-fault-finding", icon: BatteryCharging },
  { value: "service", label: "Vehicle Servicing", service: "vehicle-servicing", icon: Wrench },
  { value: "engine", label: "Engine Repair Assessment", service: "engine-repair-assessment", icon: Wrench },
  { value: "brakes", label: "Brake Repair Assessment", service: "brake-repair-assessment", icon: Disc3 },
  { value: "mobile-diagnostics", label: "Mobile Diagnostic Visit", service: "mobile-diagnostic-visit", icon: MapPin },
  { value: "inspection", label: "Pre-Purchase Inspection", service: "pre-purchase-inspection", icon: ShieldCheck },
];

type State = "input" | "loading" | "confirm" | "problem" | "manual";

export function VehicleJourney({ compact = false, source = "website", heading = "Enter your registration", lightSurface = false }: { compact?: boolean; source?: string; heading?: string; lightSurface?: boolean }) {
  const { session, updateSession, clearVehicle } = useVehicleSession();
  const [registration, setRegistration] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [error, setError] = useState("");
  const activeVehicle = vehicle || session.vehicle;
  const activeState = state || (session.vehicle ? session.vehicleConfirmed === false ? "confirm" : "problem" : "input");
  const isHomepage = source === "homepage";
  const imageId = ({
    "diagnostic-electrical-fault-finding": "electrical",
    "diagnostic-ecu-diagnostics": "module",
    "service-vehicle-servicing": "service",
    "service-engine-repair": "engine",
    "service-brake-repair": "brakes",
  } as Partial<Record<string, ContextualImageId>>)[source];

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
      updateSession({ vehicle: result.vehicle, vehicleConfirmed: false, source });
      setState("confirm");
      track("vehicle_lookup_success", { source });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vehicle lookup is unavailable.");
      setState("manual");
      track("vehicle_lookup_failed", { source });
    }
  }

  function confirm() {
    if (!activeVehicle) return;
    updateSession({ vehicle: activeVehicle, vehicleConfirmed: true, source });
    setState("problem");
  }

  function selectService(option: ServiceOption) {
    updateSession({ vehicle: activeVehicle, vehicleConfirmed: true, selectedProblem: option.label, selectedService: option.service, source });
    track("service_selected", { source, selection: option.value });
  }

  const shell = compact
    ? `rounded-2xl border p-5 shadow-2xl ${lightSurface ? "border-[#67B9FF]/30 bg-[#0B2A50]/88 backdrop-blur-xl" : "border-[#1974E2]/35 bg-[#071127]/90"}`
    : "rounded-3xl border border-[#1974E2]/30 bg-[#071127] p-6 shadow-2xl sm:p-8";
  return (
    <div className="space-y-4">
      {imageId && <ContextualServiceImage id={imageId} className="min-h-56 shadow-none sm:min-h-64" />}
      <div className={shell}>
      {activeState === "input" && (
        <form onSubmit={submit} className={cn(isHomepage && "mx-auto w-full max-w-md text-center sm:max-w-none sm:text-left")}>
          <label htmlFor={`registration-${source}`} className="mb-3 block text-xs font-extrabold tracking-[.14em] text-[#67B9FF] uppercase">{heading}</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex min-h-16 flex-1 overflow-hidden rounded-xl bg-white shadow-inner focus-within:ring-4 focus-within:ring-[#168BFF]/20">
              <span className="plate-strip grid w-12 place-items-center text-xs font-bold text-white">GB</span>
              <input id={`registration-${source}`} value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())} className="min-w-0 flex-1 border-0 bg-white px-4 font-mono text-xl font-black tracking-[.14em] text-black outline-none" placeholder="AB12 CDE" autoComplete="off" maxLength={9} aria-describedby={error ? `registration-error-${source}` : undefined} />
            </div>
            <Button type="submit" className={cn("min-h-16 px-7", isHomepage && "w-full sm:w-auto")}><Search size={19} /> Find my vehicle</Button>
          </div>
          {error && <p id={`registration-error-${source}`} className="mt-3 text-sm text-red-300">{error}</p>}
          <p className={cn("mt-3 text-xs text-[#8F9EAF]", isHomepage && "text-center sm:text-left")}>Your registration stays out of page URLs and analytics.</p>
        </form>
      )}
      {activeState === "loading" && <div className="flex min-h-32 items-center justify-center gap-3 text-white"><LoaderCircle className="animate-spin text-[#168BFF]" /> Finding your vehicle…</div>}
      {activeState === "confirm" && activeVehicle && (
        <div className="text-white">
          <p className="flex items-center gap-2 text-xs font-extrabold tracking-[.14em] text-[#67B9FF] uppercase"><Check size={16} /> Vehicle identified</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
            <div><h3 className="text-3xl font-extrabold uppercase">{[activeVehicle.make, activeVehicle.model].filter(Boolean).join(" ") || "Vehicle found"}</h3><p className="mt-1 text-[#C6D2DF]">{[activeVehicle.year, activeVehicle.fuelType, activeVehicle.engineCapacityCc ? `${activeVehicle.engineCapacityCc} cc` : undefined].filter(Boolean).join(" · ")}</p><span className="mt-4 inline-block rounded-lg bg-white px-4 py-2 font-mono text-lg font-black tracking-[.14em] text-black">{formatRegistration(activeVehicle.registration)}</span></div>
            <div className="grid gap-2"><Button type="button" onClick={confirm}>Yes, that&apos;s my vehicle <ChevronRight size={18} /></Button><button type="button" className="text-sm text-[#9AA7B6] underline" onClick={() => { clearVehicle(); setState("input"); setVehicle(null); }}>Not your vehicle?</button></div>
          </div>
        </div>
      )}
      {activeState === "manual" && (
        <div className="text-white">
          <div className="flex gap-3"><TriangleAlert className="shrink-0 text-amber-400" /><div><h3 className="text-xl font-bold">We couldn&apos;t confirm that vehicle</h3><p className="mt-1 text-sm leading-6 text-[#C6D2DF]">You can continue without lookup and add the details to your request.</p></div></div>
          <div className="mt-5 flex flex-wrap gap-3"><Button type="button" onClick={() => { const manual = { registration: normalizeRegistration(registration) }; setVehicle(manual); updateSession({ vehicle: manual, vehicleConfirmed: true, source }); setState("problem"); }}>Continue manually</Button><Button type="button" variant="secondary" onClick={() => setState("input")}>Try again</Button></div>
        </div>
      )}
      {activeState === "problem" && (
        <div className="text-white">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs font-extrabold tracking-[.14em] text-[#67B9FF] uppercase">Vehicle ready</p>
              <h3 className="mt-1 text-2xl font-extrabold">What are you looking for?</h3>
              <p className="mt-1 text-sm text-[#AEBBCC]">Choose a service to continue with your vehicle details.</p>
            </div>
            <button type="button" className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-[#AFC4D9] transition hover:bg-white/10 hover:text-white" onClick={() => { clearVehicle(); setVehicle(null); setState("input"); }}>Change vehicle</button>
          </div>
          <div className={cn("mt-5 grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
            {serviceOptions.map((option) => {
              const Icon = option.icon;
              const selected = session.selectedService === option.service;
              return (
                <Link
                  key={option.value}
                  onClick={() => selectService(option)}
                  href="/book"
                  className={cn(
                    "group flex min-h-16 items-center gap-3 rounded-xl border p-3.5 transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#168BFF]/35",
                    selected
                      ? "border-[#168BFF] bg-[#1974E2]/20"
                      : "border-white/10 bg-white/[.055] hover:-translate-y-0.5 hover:border-[#168BFF]/70 hover:bg-white/[.09] hover:shadow-lg",
                  )}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#67B9FF]/20 bg-[#168BFF]/10 text-[#67B9FF] transition group-hover:bg-[#168BFF] group-hover:text-white"><Icon size={21} strokeWidth={2} /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-extrabold text-white">{option.label}</strong>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-[#67B9FF] transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
          <Link href="/get-a-quote" className="mt-4 inline-block text-sm font-bold text-[#67B9FF] hover:underline">Prefer a quote request? Continue here →</Link>
        </div>
      )}
      </div>
    </div>
  );
}
