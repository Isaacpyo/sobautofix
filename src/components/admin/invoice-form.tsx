"use client";

import { Check, ChevronDown, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveInvoiceDraftAction, type InvoiceFormState } from "@/app/admin/(protected)/invoices/actions";
import { serviceCatalogue } from "@/config/service-catalogue";
import { calculateInvoiceTotals, formatPence, poundsToPence } from "@/lib/invoices/money";
import type { InvoiceSourceType } from "@/lib/invoices/types";
import { formatRegistration, normalizeRegistration } from "@/lib/vehicle/registration-format";
import type { VehicleDetails } from "@/types/domain";

type EditableItem = { key: string; description: string; quantity: string; unitPrice: string; locked: boolean };
export type InvoiceFormInitial = {
  id?: string; sourceType: InvoiceSourceType; bookingId?: string; enquiryId?: string; customerId?: string; vehicleId?: string;
  customerName: string; customerEmail: string; customerPhone: string; customerAddress: string; vehicleRegistration: string;
  vehicleMake: string; vehicleModel: string; serviceName: string; appointmentStart: string; issueDate: string; dueDate: string;
  discount: string; notes: string; paymentTerms: string; items: Array<{ description: string; quantity: string; unitPrice: string }>;
};

export type ExistingSourceInvoice = { id: string; reference: string; status: string };
export type InvoiceServiceCategory = { id: string; name: string; services: readonly string[] };

const baseState: InvoiceFormState = { error: "" };
const input = "mt-2 block min-h-11 w-full rounded-xl border border-[#D7E0E9] bg-white px-4 text-sm font-medium text-[#071127] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/10";
const label = "text-xs font-extrabold tracking-wide text-[#667586] uppercase";
const quantityOptions = ["0.25", "0.5", "0.75", ...Array.from({ length: 20 }, (_, index) => String(index + 1))];

export function InvoiceForm({ initial, existingSourceInvoices = [], serviceCategories = serviceCatalogue }: { initial: InvoiceFormInitial; existingSourceInvoices?: ExistingSourceInvoice[]; serviceCategories?: readonly InvoiceServiceCategory[] }) {
  const [state, action, pending] = useActionState(saveInvoiceDraftAction, baseState);
  const [items, setItems] = useState<EditableItem[]>(initial.items.map((item, index) => ({ ...item, key: `item-${index}`, locked: false })));
  const [activeItemKey, setActiveItemKey] = useState("item-0");
  const [discount, setDiscount] = useState(initial.discount);
  const totals = useMemo(() => { try { return calculateInvoiceTotals(items.map((item) => ({ quantity: item.quantity, unitPricePence: poundsToPence(item.unitPrice) })), poundsToPence(discount || "0")); } catch { return null; } }, [items, discount]);
  const clientPayload = { source_type: initial.sourceType, booking_id: initial.bookingId || "", enquiry_id: initial.enquiryId || "", customer_id: initial.customerId || "", vehicle_id: initial.vehicleId || "", customer_name: "", customer_email: "", customer_phone: "", customer_address: "", vehicle_registration: "", vehicle_make: "", vehicle_model: "", service_name: "", appointment_start: initial.appointmentStart || "", issue_date: "", due_date: "", discount_pence: safePence(discount), tax_pence: "0", notes: "", payment_terms: "", items: items.map((item) => ({ description: item.description, quantity: item.quantity, unit_price_pence: safePence(item.unitPrice) })) };

  return <form action={action} className="mt-7 grid gap-6" onSubmit={(event) => hydratePayload(event.currentTarget, clientPayload)}>
    <input type="hidden" name="invoiceId" value={initial.id || ""} /><input type="hidden" name="payload" value={JSON.stringify(clientPayload)} readOnly />
    {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{state.error}</p>}
    {existingSourceInvoices.length > 0 && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-lg font-extrabold">An active invoice already exists for this source</h2>
      <p className="mt-2 text-sm leading-6">Review the existing record before deliberately creating another draft.</p>
      <ul className="mt-3 grid gap-2 text-sm font-bold">{existingSourceInvoices.map((invoice) => <li key={invoice.id}><Link className="underline" href={`/admin/invoices/${invoice.id}`}>{invoice.reference}</Link> <span className="font-medium">({invoice.status})</span></li>)}</ul>
      <label className="mt-4 flex items-start gap-3 text-sm font-bold"><input required type="checkbox" name="confirmDuplicateSource" value="true" className="mt-1 size-4" />I have reviewed the existing invoice and intend to create another draft.</label>
    </section>}
    <FormSection title="Customer"><div className="grid gap-4 sm:grid-cols-2"><Field name="customer_name" title="Customer name" value={initial.customerName} required /><Field name="customer_email" title="Email" value={initial.customerEmail} type="email" /><Field name="customer_phone" title="Phone" value={initial.customerPhone} /><TextField name="customer_address" title="Address" value={initial.customerAddress} /></div></FormSection>
    <FormSection title="Vehicle and service"><VehicleAndServiceFields initial={initial} serviceCategories={serviceCategories} onServiceSelect={(service) => setItems((current) => {
      const target = current.find((item) => item.key === activeItemKey && !item.locked) || current.findLast((item) => !item.locked);
      return target ? current.map((item) => item.key === target.key ? { ...item, description: service } : item) : current;
    })} /></FormSection>
    <FormSection title="Invoice items" aside={<button type="button" onClick={() => {
      const key = crypto.randomUUID();
      setItems((current) => [...current, { key, description: "", quantity: "1", unitPrice: "0.00", locked: false }]);
      setActiveItemKey(key);
    }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C9D5E2] px-4 text-sm font-extrabold text-[#1446A5]"><Plus size={17} /> Add item</button>}>
      <p className="mt-1 text-sm text-[#667586]">Choose a catalogue service for the active row, enter its price, then save the row to lock it.</p><div className="mt-5 grid gap-4">{items.map((item, index) => <div key={item.key} onFocusCapture={() => { if (!item.locked) setActiveItemKey(item.key); }} className={`grid gap-3 rounded-xl p-4 transition lg:grid-cols-[1fr_9rem_10rem_6.5rem] lg:items-end ${item.locked ? "bg-[#F1F7F3]" : activeItemKey === item.key ? "bg-[#F8FAFC] ring-2 ring-[#1974E2]/25" : "bg-[#F8FAFC]"}`}><EditableField title="Description" value={item.description} disabled={item.locked} change={(value) => update(setItems, item.key, "description", value)} /><QuantityField value={item.quantity} disabled={item.locked} itemNumber={index + 1} change={(value) => update(setItems, item.key, "quantity", value)} /><EditableField title="Unit price (£)" value={item.unitPrice} disabled={item.locked} change={(value) => update(setItems, item.key, "unitPrice", value)} /><div className="flex gap-2"><button type="button" aria-label={`${item.locked ? "Edit" : "Save"} item ${index + 1}`} title={`${item.locked ? "Edit" : "Save"} item`} disabled={!item.locked && !item.description.trim()} onClick={() => {
        setItems((current) => current.map((candidate) => candidate.key === item.key ? { ...candidate, locked: !candidate.locked } : candidate));
        if (item.locked) setActiveItemKey(item.key);
      }} className="grid size-11 place-items-center rounded-xl border border-[#B8CBE0] text-[#1446A5] disabled:cursor-not-allowed disabled:opacity-35">{item.locked ? <Pencil size={17} /> : <Save size={17} />}</button><button type="button" aria-label={`Remove item ${index + 1}`} disabled={items.length === 1} onClick={() => {
        const remaining = items.filter((candidate) => candidate.key !== item.key);
        setItems(remaining);
        if (activeItemKey === item.key) setActiveItemKey(remaining.at(-1)?.key || "");
      }} className="grid size-11 place-items-center rounded-xl border border-[#D7E0E9] text-red-700 disabled:opacity-35"><Trash2 size={17} /></button></div></div>)}</div>
      <div className="mt-6 grid gap-5 border-t border-[#E4EAF0] pt-5 lg:grid-cols-[1fr_19rem]"><div className="grid gap-4 sm:grid-cols-2"><Field name="issue_date" title="Issue date" value={initial.issueDate} type="date" /><Field name="due_date" title="Due date" value={initial.dueDate} type="date" /></div><div className="rounded-xl bg-[#071127] p-5 text-white"><Money label="Subtotal" value={totals?.subtotalPence} /><label className="mt-4 block text-xs font-extrabold tracking-wide text-[#B8C6D6] uppercase">Discount (£)<input value={discount} onChange={(event) => setDiscount(event.target.value)} inputMode="decimal" className="mt-2 min-h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 font-bold text-white" /></label><div className="mt-5 border-t border-white/20 pt-4"><Money label="Total GBP" value={totals?.totalPence} large /></div><p className="mt-3 text-xs text-[#B8C6D6]">VAT is not shown because no approved VAT configuration exists.</p></div></div>
    </FormSection>
    <FormSection title="Terms and notes"><div className="grid gap-4 sm:grid-cols-2"><TextField name="payment_terms" title="Payment terms" value={initial.paymentTerms} /><TextField name="notes" title="Notes" value={initial.notes} /></div></FormSection>
    <div className="flex justify-end"><button disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1974E2] px-6 text-sm font-extrabold text-white disabled:opacity-60"><Save size={18} />{pending ? "Saving…" : initial.id ? "Save changes" : "Save draft"}</button></div>
  </form>;
}

function FormSection({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-extrabold text-[#071127]">{title}</h2>{aside}</div>{children}</section>; }
function Field({ name, title, value, type = "text", required = false, upper = false }: { name: string; title: string; value: string; type?: string; required?: boolean; upper?: boolean }) { return <label className={label}>{title}<input name={name} type={type} defaultValue={value} required={required} className={`${input} ${upper ? "uppercase" : ""}`} /></label>; }
type LookupResponse = { success: true; vehicle: VehicleDetails } | { success: false; error: { message: string } };

function VehicleAndServiceFields({ initial, serviceCategories, onServiceSelect }: { initial: InvoiceFormInitial; serviceCategories: readonly InvoiceServiceCategory[]; onServiceSelect: (service: string) => void }) {
  const [registration, setRegistration] = useState(initial.vehicleRegistration);
  const [make, setMake] = useState(initial.vehicleMake);
  const [model, setModel] = useState(initial.vehicleModel);
  const [service, setService] = useState(initial.serviceName);
  const [query, setQuery] = useState("");
  const [lookupState, setLookupState] = useState<{ loading: boolean; message: string; error: boolean }>({ loading: false, message: "", error: false });
  const normalizedRegistration = normalizeRegistration(registration);
  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-GB");
    if (!normalizedQuery) return serviceCategories;
    return serviceCategories.map((category) => ({ ...category, services: category.services.filter((name) => `${category.name} ${name}`.toLocaleLowerCase("en-GB").includes(normalizedQuery)) })).filter((category) => category.services.length > 0);
  }, [query, serviceCategories]);
  const canonical = serviceCategories.some((category) => category.services.some((option) => option.toLocaleLowerCase("en-GB") === service.trim().toLocaleLowerCase("en-GB")));

  async function lookupVehicle() {
    if (normalizedRegistration.length < 2 || normalizedRegistration.length > 8) {
      setLookupState({ loading: false, message: "Enter a valid UK registration, or continue with manual vehicle details.", error: true });
      return;
    }
    setLookupState({ loading: true, message: `Looking up ${formatRegistration(normalizedRegistration)}…`, error: false });
    try {
      const response = await fetch("/api/vehicle/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration: normalizedRegistration }) });
      const result = await response.json() as LookupResponse;
      if (!result.success) {
        setLookupState({ loading: false, message: `${result.error.message} Manual entry is still available.`, error: true });
        return;
      }
      setRegistration(result.vehicle.registration || normalizedRegistration);
      if (result.vehicle.make) setMake(result.vehicle.make);
      if (result.vehicle.model) setModel(result.vehicle.model);
      setLookupState({ loading: false, message: result.vehicle.model ? "Vehicle make and model populated. You can edit them before saving." : "Available vehicle details populated. Add or correct the model manually if needed.", error: false });
    } catch {
      setLookupState({ loading: false, message: "Vehicle lookup is temporarily unavailable. Enter the make and model manually to continue.", error: true });
    }
  }

  function selectService(next: string) {
    setService(next);
    onServiceSelect(next);
  }

  return <div className="mt-5 grid gap-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr]">
      <label className={label}>Registration
        <span className="mt-2 flex gap-2"><input name="vehicle_registration" value={formatRegistration(registration)} onChange={(event) => setRegistration(event.target.value)} maxLength={9} autoComplete="off" className={`${input} mt-0 font-mono uppercase`} /><button type="button" onClick={lookupVehicle} disabled={lookupState.loading} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#071127] px-4 text-sm font-extrabold normal-case tracking-normal text-white disabled:opacity-60"><Search size={16} />{lookupState.loading ? "Looking…" : "Lookup"}</button></span>
      </label>
      <label className={label}>Make<input name="vehicle_make" value={make} onChange={(event) => setMake(event.target.value)} className={input} /></label>
      <label className={label}>Model<input name="vehicle_model" value={model} onChange={(event) => setModel(event.target.value)} className={input} /></label>
    </div>
    {lookupState.message && <p role={lookupState.error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm font-semibold ${lookupState.error ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-800"}`}>{lookupState.message}</p>}
    <div>
      <input type="hidden" name="service_name" value={service} />
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={label}>Service catalogue</p><p className="mt-1 text-sm text-[#667586]">Search or open a vehicle system, then choose a service.</p></div>{service && <div className="rounded-xl bg-[#EAF3FF] px-4 py-3 text-sm font-extrabold text-[#1446A5]"><Check className="mr-2 inline" size={16} />{service}{!canonical ? " (current)" : ""}</div>}</div>
      <label className="relative mt-4 block"><span className="sr-only">Search services</span><Search aria-hidden="true" className="absolute top-1/2 left-4 -translate-y-1/2 text-[#667586]" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services…" className={`${input} mt-0 pl-11`} /></label>
      <div className="mt-4 max-h-[30rem] overflow-y-auto rounded-xl border border-[#D7E0E9] bg-[#F8FAFC] p-2">
        {filteredCategories.map((category) => <details key={category.id} open={Boolean(query) || undefined} className="group rounded-lg bg-white open:shadow-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-[#071127] focus-visible:outline-2 focus-visible:outline-[#1974E2]"><span>{category.name} <span className="font-medium text-[#667586]">({category.services.length})</span></span><ChevronDown aria-hidden="true" className="text-[#1974E2] transition group-open:rotate-180" size={17} /></summary>
          <div className="grid gap-1 border-t border-[#E4EAF0] p-2 sm:grid-cols-2">
            {category.services.map((option) => <button key={option} type="button" aria-pressed={service === option} onClick={() => selectService(option)} className={`min-h-11 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${service === option ? "bg-[#1974E2] text-white" : "text-[#263446] hover:bg-[#EAF3FF] hover:text-[#1446A5]"}`}>{option}</button>)}
          </div>
        </details>)}
        {filteredCategories.length === 0 && <p className="p-5 text-center text-sm font-semibold text-[#667586]">No services match that search. You can still describe custom work in the invoice items below.</p>}
      </div>
    </div>
  </div>;
}
function TextField({ name, title, value }: { name: string; title: string; value: string }) { return <label className={label}>{title}<textarea name={name} defaultValue={value} rows={4} className={`${input} py-3`} /></label>; }
function EditableField({ title, value, disabled, change }: { title: string; value: string; disabled: boolean; change: (value: string) => void }) { return <label className={label}>{title}<input value={value} onChange={(event) => change(event.target.value)} inputMode={title === "Description" ? undefined : "decimal"} required disabled={disabled} className={`${input} disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:px-0`} /></label>; }
function QuantityField({ value, disabled, itemNumber, change }: { value: string; disabled: boolean; itemNumber: number; change: (value: string) => void }) {
  const options = quantityOptions.includes(value) ? quantityOptions : [value, ...quantityOptions];
  return <label className={label}>Quantity<select aria-label={`Quantity for item ${itemNumber}`} value={value} onChange={(event) => change(event.target.value)} disabled={disabled} required className={`${input} appearance-none bg-[linear-gradient(45deg,transparent_50%,#667586_50%),linear-gradient(135deg,#667586_50%,transparent_50%)] bg-[position:calc(100%-18px)_50%,calc(100%-13px)_50%] bg-[size:5px_5px,5px_5px] bg-no-repeat pr-10 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-none disabled:px-0`}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
function Money({ label: text, value, large = false }: { label: string; value?: bigint; large?: boolean }) { return <div className={`flex justify-between gap-4 ${large ? "text-lg font-extrabold" : "text-sm"}`}><span>{text}</span><span>{value == null ? "—" : formatPence(value)}</span></div>; }
function safePence(value: string) { try { return poundsToPence(value || "0").toString(); } catch { return "-1"; } }
function update(setter: React.Dispatch<React.SetStateAction<EditableItem[]>>, key: string, name: "description" | "quantity" | "unitPrice", value: string) { setter((items) => items.map((item) => item.key === key ? { ...item, [name]: value } : item)); }
function hydratePayload(form: HTMLFormElement, payload: Record<string, unknown>) { const data = new FormData(form); const hydrated = { ...payload }; for (const key of ["customer_name", "customer_email", "customer_phone", "customer_address", "vehicle_registration", "vehicle_make", "vehicle_model", "service_name", "issue_date", "due_date", "notes", "payment_terms"]) hydrated[key] = String(data.get(key) || ""); (form.elements.namedItem("payload") as HTMLInputElement).value = JSON.stringify(hydrated); }
