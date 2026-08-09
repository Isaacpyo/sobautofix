"use client";

import { CarFront, X } from "lucide-react";
import { formatRegistration } from "@/lib/vehicle/registration-format";
import { useVehicleSession } from "./vehicle-context";

export function VehicleSummary({ dark = false }: { dark?: boolean }) {
  const { session, clearVehicle } = useVehicleSession();
  if (!session.vehicle) return null;
  const vehicle = session.vehicle;
  return (
    <div className={dark ? "flex items-center gap-3 rounded-xl border border-[#67B9FF]/25 bg-white/5 p-4 text-white" : "flex items-center gap-3 rounded-xl border border-[#1974E2]/20 bg-[#F4F7FA] p-4 text-[#071127]"}>
      <CarFront className="shrink-0 text-[#168BFF]" />
      <div className="min-w-0 flex-1"><span className="block text-[10px] font-extrabold tracking-[.15em] text-[#1974E2] uppercase">Your vehicle</span><strong className="block truncate">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"} · {formatRegistration(vehicle.registration)}</strong></div>
      <button type="button" onClick={clearVehicle} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#1974E2]/10" aria-label="Change vehicle"><X size={18} /></button>
    </div>
  );
}
