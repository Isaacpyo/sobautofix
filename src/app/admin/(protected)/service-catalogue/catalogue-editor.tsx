"use client";

import { ChevronDown, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { manageTrashAction } from "@/app/admin/(protected)/trash/actions";
import { AdminBulkActions, AdminItemCheckbox } from "@/components/admin/admin-bulk-actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import type { CatalogueService, CatalogueSystem } from "@/lib/service-catalogue/repository";
import { cn } from "@/lib/utils";
import {
  createCatalogueServiceAction,
  createCatalogueSystemAction,
  type CatalogueActionState,
  trashCatalogueItemAction,
  updateCatalogueServiceAction,
  updateCatalogueSystemAction,
} from "./actions";

const initialState: CatalogueActionState = { success: false, message: "" };
const input = "mt-2 min-h-11 w-full rounded-xl border border-[#C9D5E2] bg-white px-3 text-sm text-[#071127] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15";
const label = "text-xs font-extrabold tracking-wide text-[#667586] uppercase";

export function CatalogueEditor({ systems }: { systems: CatalogueSystem[] }) {
  return <>
    <CreateSystemForm nextOrder={(systems.at(-1)?.sortOrder || 0) + 10} />
    <AdminBulkActions entity="catalogue_systems" action={manageTrashAction}>
      <div className="mt-4 grid gap-5">
        {systems.map((system) => <details key={system.id} className="group overflow-hidden rounded-2xl border border-[#DCE6F2] bg-white open:border-[#1974E2]/40 open:shadow-lg">
          <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 px-3 py-4 sm:px-5">
            <AdminItemCheckbox id={system.id} label={`Select vehicle system ${system.name}`} />
            <span className="min-w-0 flex-1"><strong className="block text-lg text-[#071127]">{system.name}</strong><span className="mt-1 block text-sm text-[#667586]">{system.services.length} services · {system.key}</span></span>
            <ChevronDown className="shrink-0 text-[#1974E2] transition group-open:rotate-180" size={20} aria-hidden="true" />
          </summary>
          <div className="border-t border-[#E4EAF0] bg-[#F8FAFC] p-4 sm:p-6">
            <SystemForm system={system} />
            <div className="mt-6 border-t border-[#DCE6F2] pt-6">
              <h3 className="text-lg font-extrabold text-[#071127]">Services under {system.name}</h3>
              <p className="mt-1 text-sm text-[#667586]">Changes appear in the booking form, invoice catalogue and public services catalogue.</p>
              <CreateServiceForm system={system} nextOrder={(system.services.at(-1)?.sortOrder || 0) + 10} />
              <AdminBulkActions entity="catalogue_services" action={manageTrashAction}>
                <div className="mt-4 grid gap-4">
                  {system.services.map((service) => <ServiceForm key={service.id} service={service} systems={systems} />)}
                  {!system.services.length && <p className="rounded-xl border border-dashed border-[#C9D5E2] bg-white p-6 text-center text-sm text-[#667586]">No services in this vehicle system yet.</p>}
                </div>
              </AdminBulkActions>
            </div>
          </div>
        </details>)}
        {!systems.length && <p className="rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">No active vehicle systems. Restore one from Trash or add a new system.</p>}
      </div>
    </AdminBulkActions>
  </>;
}

function CreateSystemForm({ nextOrder }: { nextOrder: number }) {
  const [state, action, pending] = useActionState(createCatalogueSystemAction, initialState);
  return <form action={action} className="mt-7 rounded-2xl border border-[#BBD9FA] bg-[#F1F7FF] p-5">
    <h2 className="text-xl font-extrabold text-[#071127]">Add vehicle system</h2>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.7fr_8rem_auto] lg:items-end">
      <Field name="name" title="System name" required />
      <Field name="description" title="Description" required />
      <Field name="sortOrder" title="Display order" type="number" value={String(nextOrder)} required />
      <SaveButton pending={pending} text="Add system" icon="plus" />
    </div>
    <Result state={state} />
  </form>;
}

function SystemForm({ system }: { system: CatalogueSystem }) {
  const [state, action, pending] = useActionState(updateCatalogueSystemAction, initialState);
  return <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_1.7fr_8rem_auto] lg:items-end">
      <input type="hidden" name="id" value={system.id} />
      <Field name="name" title="System name" value={system.name} required />
      <Field name="description" title="Description" value={system.description} required />
      <Field name="sortOrder" title="Display order" type="number" value={String(system.sortOrder)} required />
      <SaveButton pending={pending} text="Save system" />
      <div className="lg:col-span-4"><Result state={state} /></div>
    </form>
    <TrashForm entity="catalogue_systems" id={system.id} label={system.name} />
  </div>;
}

function CreateServiceForm({ system, nextOrder }: { system: CatalogueSystem; nextOrder: number }) {
  const [state, action, pending] = useActionState(createCatalogueServiceAction, initialState);
  return <form action={action} className="mt-5 rounded-xl border border-[#D7E0E9] bg-white p-4">
    <input type="hidden" name="systemId" value={system.id} />
    <p className="text-sm font-extrabold text-[#1446A5]">Add a service</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.5fr_8rem_10rem_10rem_auto] xl:items-end">
      <Field name="name" title="Service name" required />
      <Field name="description" title="Customer description" required />
      <Field name="sortOrder" title="Order" type="number" value={String(nextOrder)} required />
      <LocationField />
      <Field name="providerEventTypeId" title="Calendar event ID" type="number" />
      <SaveButton pending={pending} text="Add service" icon="plus" />
    </div>
    <label className="mt-3 flex items-center gap-2 text-sm font-bold text-[#071127]"><input type="checkbox" name="onlineBookingEnabled" className="size-4 accent-[#1974E2]" /> Available for online booking</label>
    <Result state={state} />
  </form>;
}

function ServiceForm({ service, systems }: { service: CatalogueService; systems: CatalogueSystem[] }) {
  const [state, action, pending] = useActionState(updateCatalogueServiceAction, initialState);
  return <article className="relative rounded-xl border border-[#D7E0E9] bg-white p-4 pl-14">
    <div className="absolute left-2 top-3"><AdminItemCheckbox id={service.id} label={`Select service ${service.name}`} /></div>
    <form action={action}>
      <input type="hidden" name="id" value={service.id} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.5fr_12rem_7rem]">
        <Field name="name" title="Service name" value={service.name} required />
        <Field name="description" title="Customer description" value={service.description} required />
        <label className={label}>Vehicle system<select name="systemId" defaultValue={systems.find((system) => system.services.some((candidate) => candidate.id === service.id))?.id} className={input}>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></label>
        <Field name="sortOrder" title="Order" type="number" value={String(service.sortOrder)} required />
        <LocationField value={service.locationMode} />
        <Field name="providerEventTypeId" title="Calendar event ID" type="number" value={service.providerEventTypeId ? String(service.providerEventTypeId) : ""} />
        <label className={`${label} flex min-h-11 items-center gap-2 self-end rounded-xl border border-[#D7E0E9] px-3`}><input type="checkbox" name="onlineBookingEnabled" defaultChecked={service.onlineBookingEnabled} className="size-4 accent-[#1974E2]" /> Online booking</label>
        <SaveButton pending={pending} text="Save service" />
      </div>
      <Result state={state} />
    </form>
    <div className="mt-3 flex justify-end"><TrashForm entity="catalogue_services" id={service.id} label={service.name} /></div>
  </article>;
}

function Field({ name, title, value, type = "text", required = false }: { name: string; title: string; value?: string; type?: string; required?: boolean }) {
  return <label className={label}>{title}<input name={name} type={type} min={type === "number" ? 0 : undefined} defaultValue={value} required={required} className={input} /></label>;
}

function LocationField({ value = "workshop" }: { value?: CatalogueService["locationMode"] }) {
  return <label className={label}>Location<select name="locationMode" defaultValue={value} className={input}><option value="workshop">Workshop</option><option value="mobile">Mobile</option><option value="both">Workshop or mobile</option></select></label>;
}

function SaveButton({ pending, text, icon }: { pending: boolean; text: string; icon?: "plus" }) {
  return <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-extrabold text-white disabled:opacity-60">{pending ? <LoaderCircle className="animate-spin" size={17} /> : icon === "plus" ? <Plus size={17} /> : <Save size={17} />}{pending ? "Saving…" : text}</button>;
}

function TrashForm({ entity, id, label: itemLabel }: { entity: "catalogue_systems" | "catalogue_services"; id: string; label: string }) {
  return <form action={trashCatalogueItemAction}><input type="hidden" name="entity" value={entity} /><input type="hidden" name="intent" value="trash" /><input type="hidden" name="ids" value={id} /><ConfirmSubmitButton message={`Move “${itemLabel}” to Trash? It will disappear from booking, invoices and the public catalogue until restored.`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-extrabold text-red-700"><Trash2 size={16} /> Move to trash</ConfirmSubmitButton></form>;
}

function Result({ state }: { state: CatalogueActionState }) {
  return state.message ? <p role={state.success ? "status" : "alert"} className={cn("mt-3 rounded-lg px-3 py-2 text-sm font-bold", state.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{state.message}</p> : null;
}
