"use client";

import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { saveBookingServiceMappingAction } from "../actions";

const initialState = { success: false, message: "" };

export function ServiceMappingForm({
  service,
}: {
  service: {
    id: string;
    key: string;
    name: string;
    description: string;
    providerEventTypeId: number | null;
    onlineBookingEnabled: boolean;
    locationMode: "workshop" | "mobile" | "both";
  };
}) {
  const [state, action, pending] = useActionState(saveBookingServiceMappingAction, initialState);

  return (
    <form action={action} className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6">
      <input type="hidden" name="id" value={service.id} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">{service.key}</p>
          <h2 className="mt-2 text-xl font-extrabold text-[#071127]">{service.name}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667586]">{service.description}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1.5 text-xs font-extrabold", service.onlineBookingEnabled ? "bg-green-100 text-green-800" : "bg-[#E4EAF0] text-[#586575]")}>{service.onlineBookingEnabled ? "Online booking on" : "Online booking off"}</span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <label className="text-sm font-bold text-[#071127]">
          Calendar event type ID
          <input
            name="providerEventTypeId"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            defaultValue={service.providerEventTypeId ?? ""}
            placeholder="Positive whole number"
            className="mt-2 min-h-12 w-full rounded-xl border border-[#C9D5E2] bg-white px-4 outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15"
          />
        </label>
        <label className="text-sm font-bold text-[#071127]">
          Location mode
          <select name="locationMode" defaultValue={service.locationMode} className="mt-2 min-h-12 w-full rounded-xl border border-[#C9D5E2] bg-white px-4 outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15">
            <option value="workshop">Workshop</option>
            <option value="mobile">Mobile</option>
            <option value="both">Workshop or mobile</option>
          </select>
        </label>
        <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1974E2] px-5 text-sm font-extrabold text-white transition hover:bg-[#168BFF] disabled:cursor-wait disabled:opacity-65">
          {pending ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
          Save
        </button>
      </div>

      <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#071127]">
        <input name="onlineBookingEnabled" type="checkbox" defaultChecked={service.onlineBookingEnabled} className="size-5 accent-[#1974E2]" />
        Allow customers to book this service online
      </label>
      <p className="mt-2 text-xs leading-5 text-[#667586]">Online booking cannot be enabled until a positive event type ID is saved.</p>

      {state.message && (
        <p className={cn("mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold", state.success ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900")} role={state.success ? "status" : "alert"}>
          {state.success && <CheckCircle2 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />}
          {state.message}
        </p>
      )}
    </form>
  );
}
