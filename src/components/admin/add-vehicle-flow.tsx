"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatRegistration, normalizeRegistration } from "@/lib/vehicle/registration-format";
import type { VehicleDetails } from "@/types/domain";
import { AdminField } from "./content-editor";
import { VehicleFeatureSelector } from "./vehicle-feature-selector";

type Duplicate = { id: string; label: string; status: string };
type LookupResponse = { success: true; vehicle: VehicleDetails; duplicate: Duplicate | null } | { success: false; error: { code: string; message: string } };
type VehicleSaveState = { status: "idle" | "error" | "saved"; message: string; vehicleId?: string };
type NewVehicleAction = (previous: VehicleSaveState, formData: FormData) => Promise<VehicleSaveState>;

export function AddVehicleFlow({ action, inventoryReady = true }: { action: NewVehicleAction; inventoryReady?: boolean }) {
  const [registration, setRegistration] = useState("");
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [stage, setStage] = useState<"lookup" | "verify" | "sales">("lookup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEnterManually, setCanEnterManually] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const normalized = normalizeRegistration(registration);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCanEnterManually(false);
    if (normalized.length < 2 || normalized.length > 8) { setError("Check the registration number and try again."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/admin/inventory/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration: normalized }) });
      const result = await response.json() as LookupResponse;
      if (!result.success) { setError(result.error.message); setCanEnterManually(result.error.code !== "invalid"); return; }
      setVehicle(result.vehicle);
      setDuplicate(result.duplicate);
      setStage("verify");
    } catch {
      setError("Vehicle lookup is temporarily unavailable. You can try again or enter the vehicle manually.");
      setCanEnterManually(true);
    } finally { setLoading(false); }
  }

  function searchAgain() {
    setVehicle(null); setDuplicate(null); setError(null); setStage("lookup"); setEditingIdentity(false);
  }

  function enterManually() {
    setVehicle({ registration: normalized }); setDuplicate(null); setStage("sales"); setEditingIdentity(true); setError(null);
  }

  return <div className="mx-auto max-w-4xl">
    {stage === "lookup" && <section className="max-w-2xl rounded-2xl border border-[#E4EAF0] bg-white p-6 sm:p-8">
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Step 1 of 2</p>
      <h2 className="mt-2 text-2xl font-extrabold text-[#071127]">Find the vehicle</h2>
      <p className="mt-2 text-sm leading-6 text-[#667586]">Enter the UK registration number and we&apos;ll load the available vehicle details.</p>
      <form onSubmit={lookup} className="mt-7 grid gap-4">
        <label className="text-sm font-bold text-[#071127]">Registration number
          <input autoFocus aria-describedby="registration-help" autoComplete="off" inputMode="text" value={formatRegistration(registration)} onChange={(event) => setRegistration(event.target.value)} maxLength={9} className="mt-2 block min-h-16 w-full rounded-xl border-2 border-[#071127] bg-[#FFD43B] px-5 font-mono text-2xl font-black uppercase tracking-[0.18em] text-[#071127]" placeholder="AB12 CDE" />
        </label>
        <span id="registration-help" className="sr-only">Spaces and letter case do not matter.</span>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
        <Button type="submit" disabled={loading} className="w-full sm:w-fit">{loading ? `Looking up ${formatRegistration(normalized)}...` : "Look up vehicle"}</Button>
        {canEnterManually && <button type="button" onClick={enterManually} className="min-h-11 justify-self-start text-sm font-bold text-[#1974E2] underline">Enter details manually</button>}
      </form>
    </section>}

    {stage === "verify" && vehicle && <section className="rounded-2xl border border-[#B9D8FF] bg-white p-6 sm:p-8">
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Vehicle found</p>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-5"><div><div className="inline-block rounded-md bg-[#FFD43B] px-4 py-2 font-mono text-xl font-black tracking-[0.12em] text-[#071127]">{formatRegistration(vehicle.registration)}</div><h2 className="mt-4 text-3xl font-extrabold text-[#071127]">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle details returned"}</h2><VehicleFacts vehicle={vehicle} /></div></div>
      {duplicate && <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5"><strong className="text-[#071127]">This vehicle already exists in Vehicle Stock.</strong><p className="mt-1 text-sm text-[#5B6472]">{duplicate.label || formatRegistration(vehicle.registration)} · Status: <span className="capitalize">{duplicate.status}</span></p><Link href={`/admin/inventory/${duplicate.id}`} className="mt-3 inline-block text-sm font-bold text-[#1974E2] underline">View existing vehicle</Link></div>}
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={searchAgain}><ArrowLeft aria-hidden="true" size={17} /> Not the right vehicle</Button><Button type="button" disabled={Boolean(duplicate)} onClick={() => { setEditingIdentity(!vehicle.make || !vehicle.model || !vehicle.year || !vehicle.fuelType || !vehicle.transmission); setStage("sales"); }}>Confirm &amp; continue</Button></div>
    </section>}

    {stage === "sales" && vehicle && <SalesForm action={action} initial={vehicle} editing={editingIdentity} setEditing={setEditingIdentity} onSearchAgain={searchAgain} inventoryReady={inventoryReady} />}
  </div>;
}

function VehicleFacts({ vehicle }: { vehicle: VehicleDetails }) {
  const facts = [vehicle.derivative, vehicle.year?.toString(), vehicle.fuelType, vehicle.transmission, vehicle.colour, vehicle.bodyType, vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc.toLocaleString("en-GB")} cc` : undefined].filter(Boolean);
  return facts.length ? <p className="mt-3 text-sm leading-7 text-[#667586]">{facts.join(" · ")}</p> : null;
}

function SalesForm({ action, initial, editing, setEditing, onSearchAgain, inventoryReady }: { action: NewVehicleAction; initial: VehicleDetails; editing: boolean; setEditing: (value: boolean) => void; onSearchAgain: () => void; inventoryReady: boolean }) {
  const slug = useMemo(() => [initial.year, initial.make, initial.model, initial.registration].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), [initial]);
  const router = useRouter();
  const [saveState, formAction, saving] = useActionState(action, { status: "idle", message: "" });
  const [saveIntent, setSaveIntent] = useState<"draft" | "publish">("draft");
  useEffect(() => { if (saveState.status === "saved" && saveState.vehicleId) router.push(`/admin/inventory/${saveState.vehicleId}`); }, [router, saveState]);
  return <form action={formAction} className="grid gap-6">
    <input type="hidden" name="registration" value={normalizeRegistration(initial.registration)} />
    <input type="hidden" name="slug" value={slug || normalizeRegistration(initial.registration).toLowerCase()} />
    <section className="rounded-2xl border border-[#E4EAF0] bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Step 2 of 2</p><h2 className="mt-2 text-2xl font-extrabold text-[#071127]">Add sales details</h2></div><button type="button" onClick={onSearchAgain} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1974E2] underline"><ArrowLeft aria-hidden="true" size={17} /> Search again</button></div>
      <div className="mt-7 rounded-xl bg-[#F4F7FA] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-extrabold text-[#071127]">Vehicle details</h3><p className="mt-1 text-sm text-[#667586]">{[initial.make, initial.model].filter(Boolean).join(" ") || "Manual vehicle entry"} · {formatRegistration(initial.registration)}</p></div><button type="button" onClick={() => setEditing(!editing)} className="text-sm font-bold text-[#1974E2]">{editing ? "Finish editing" : "Edit vehicle details"}</button></div>
        {!editing && <VehicleFacts vehicle={initial} />}
        {editing && <div className="mt-5 grid gap-4 md:grid-cols-2"><AdminField label="Make"><input name="make" required defaultValue={initial.make} /></AdminField><AdminField label="Model"><input name="model" required defaultValue={initial.model} /></AdminField><AdminField label="Derivative"><input name="derivative" defaultValue={initial.derivative} /></AdminField><AdminField label="Year"><input name="year" type="number" min="1885" max="2100" required defaultValue={initial.year} /></AdminField><AdminField label="Fuel"><input name="fuelType" required defaultValue={initial.fuelType} /></AdminField><AdminField label="Transmission"><input name="transmission" required defaultValue={initial.transmission} /></AdminField><AdminField label="Colour"><input name="colour" defaultValue={initial.colour} /></AdminField><AdminField label="Body type"><input name="bodyType" defaultValue={initial.bodyType} /></AdminField><AdminField label="Engine size"><input name="engineSize" defaultValue={initial.engineCapacityCc ? `${initial.engineCapacityCc} cc` : ""} /></AdminField></div>}
        {!editing && <><input type="hidden" name="make" value={initial.make || ""} /><input type="hidden" name="model" value={initial.model || ""} /><input type="hidden" name="derivative" value={initial.derivative || ""} /><input type="hidden" name="year" value={initial.year || ""} /><input type="hidden" name="fuelType" value={initial.fuelType || ""} /><input type="hidden" name="transmission" value={initial.transmission || ""} /><input type="hidden" name="colour" value={initial.colour || ""} /><input type="hidden" name="bodyType" value={initial.bodyType || ""} /><input type="hidden" name="engineSize" value={initial.engineCapacityCc ? `${initial.engineCapacityCc} cc` : ""} /></>}
      </div>
    </section>
    <section className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6 sm:p-8 md:grid-cols-2"><div className="md:col-span-2"><h3 className="text-xl font-extrabold text-[#071127]">Sales details</h3><p className="mt-1 text-sm text-[#667586]">Enter the information specific to this sale. Mileage and price are never inferred.</p></div><AdminField label="Current mileage"><input name="mileage" required type="number" min="0" inputMode="numeric" placeholder="83000" /></AdminField><AdminField label="Asking price (£)"><input name="price" required type="number" min="0" inputMode="numeric" placeholder="6995" /></AdminField><div className="md:col-span-2"><AdminField label="Description"><textarea name="description" required minLength={20} rows={6} placeholder="Describe verified condition, equipment, service information and relevant sale details." /></AdminField></div><div className="md:col-span-2"><VehicleFeatureSelector /></div><input type="hidden" name="financeAvailable" value="" /><input type="hidden" name="warrantyAvailable" value="" /></section>
    <PhotoPicker />
    {!inventoryReady && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Vehicle Stock is waiting for its database update. Saving is temporarily disabled so this page does not crash.</div>}
    {saveState.status === "error" && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{saveState.message}</div>}
    <div className="sticky bottom-4 flex flex-col-reverse gap-3 rounded-2xl border border-[#E4EAF0] bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:justify-end"><Button type="submit" name="inventoryIntent" value="draft" variant="outline" disabled={!inventoryReady || saving} onClick={() => setSaveIntent("draft")}>{saving && saveIntent === "draft" ? "Saving draft..." : "Save draft"}</Button><Button type="submit" name="inventoryIntent" value="publish" disabled={!inventoryReady || saving} onClick={() => setSaveIntent("publish")}>{saving && saveIntent === "publish" ? "Publishing..." : "Publish vehicle"}</Button></div>
  </form>;
}

function PhotoPicker() {
  const [previews, setPreviews] = useState<Array<{ name: string; url: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  return <section className="rounded-2xl border border-[#E4EAF0] bg-white p-6 sm:p-8"><h3 className="text-xl font-extrabold text-[#071127]">Vehicle photos</h3><p className="mt-1 text-sm text-[#667586]">Upload up to eight genuine JPG, PNG or WebP photos (32 MB combined). The first photo becomes the primary image; you can add more, reorder and edit alt text after saving.</p><input className="mt-5 block w-full rounded-xl border border-[#D7E0E9] p-4" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = Array.from(event.target.files || []); const message = files.length > 8 || files.some((file) => file.size > 8 * 1024 * 1024) || files.reduce((total, file) => total + file.size, 0) > 32 * 1024 * 1024 ? "Choose up to eight photos, each under 8 MB and under 32 MB combined." : ""; event.currentTarget.setCustomValidity(message); setError(message); setPreviews(files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }))); }} />{error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}{previews.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-live="polite">{previews.map((preview, index) => <figure key={`${preview.name}-${index}`} className="overflow-hidden rounded-xl border border-[#D7E0E9] bg-[#F4F7FA]"><div className="relative aspect-[4/3]"><Image src={preview.url} alt={`Selected vehicle photo ${index + 1}`} fill unoptimized className="object-cover" /></div><figcaption className="truncate px-3 py-2 text-xs font-semibold text-[#667586]">{index === 0 ? "Primary · " : ""}{preview.name}</figcaption></figure>)}</div>}</section>;
}
