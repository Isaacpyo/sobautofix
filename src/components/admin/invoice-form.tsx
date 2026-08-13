"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveInvoiceDraftAction, type InvoiceFormState } from "@/app/admin/(protected)/invoices/actions";
import { calculateInvoiceTotals, formatPence, poundsToPence } from "@/lib/invoices/money";
import { invoiceServiceOptions } from "@/lib/invoices/service-options";
import type { InvoiceSourceType } from "@/lib/invoices/types";

type EditableItem = { key: string; description: string; quantity: string; unitPrice: string };
export type InvoiceFormInitial = {
  id?: string; sourceType: InvoiceSourceType; bookingId?: string; enquiryId?: string; customerId?: string; vehicleId?: string;
  customerName: string; customerEmail: string; customerPhone: string; customerAddress: string; vehicleRegistration: string;
  vehicleMake: string; vehicleModel: string; serviceName: string; appointmentStart: string; issueDate: string; dueDate: string;
  discount: string; notes: string; paymentTerms: string; items: Array<{ description: string; quantity: string; unitPrice: string }>;
};

export type ExistingSourceInvoice = { id: string; reference: string; status: string };

const baseState: InvoiceFormState = { error: "" };
const input = "mt-2 block min-h-11 w-full rounded-xl border border-[#D7E0E9] bg-white px-4 text-sm font-medium text-[#071127] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/10";
const label = "text-xs font-extrabold tracking-wide text-[#667586] uppercase";

export function InvoiceForm({ initial, existingSourceInvoices = [] }: { initial: InvoiceFormInitial; existingSourceInvoices?: ExistingSourceInvoice[] }) {
  const [state, action, pending] = useActionState(saveInvoiceDraftAction, baseState);
  const [items, setItems] = useState<EditableItem[]>(initial.items.map((item, index) => ({ ...item, key: `item-${index}` })));
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
    <FormSection title="Vehicle and service"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field name="vehicle_registration" title="Registration" value={initial.vehicleRegistration} upper /><Field name="vehicle_make" title="Make" value={initial.vehicleMake} /><Field name="vehicle_model" title="Model" value={initial.vehicleModel} /><ServiceField value={initial.serviceName} /></div></FormSection>
    <FormSection title="Invoice items" aside={<button type="button" onClick={() => setItems((current) => [...current, { key: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "0.00" }])} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C9D5E2] px-4 text-sm font-extrabold text-[#1446A5]"><Plus size={17} /> Add item</button>}>
      <p className="mt-1 text-sm text-[#667586]">Prices are entered in pounds and stored as integer pence.</p><div className="mt-5 grid gap-4">{items.map((item, index) => <div key={item.key} className="grid gap-3 rounded-xl bg-[#F8FAFC] p-4 lg:grid-cols-[1fr_8rem_10rem_3rem] lg:items-end"><EditableField title="Description" value={item.description} change={(value) => update(setItems, item.key, "description", value)} /><EditableField title="Quantity" value={item.quantity} change={(value) => update(setItems, item.key, "quantity", value)} /><EditableField title="Unit price (£)" value={item.unitPrice} change={(value) => update(setItems, item.key, "unitPrice", value)} /><button type="button" aria-label={`Remove item ${index + 1}`} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} className="grid size-11 place-items-center rounded-xl border border-[#D7E0E9] text-red-700 disabled:opacity-35"><Trash2 size={17} /></button></div>)}</div>
      <div className="mt-6 grid gap-5 border-t border-[#E4EAF0] pt-5 lg:grid-cols-[1fr_19rem]"><div className="grid gap-4 sm:grid-cols-2"><Field name="issue_date" title="Issue date" value={initial.issueDate} type="date" /><Field name="due_date" title="Due date" value={initial.dueDate} type="date" /></div><div className="rounded-xl bg-[#071127] p-5 text-white"><Money label="Subtotal" value={totals?.subtotalPence} /><label className="mt-4 block text-xs font-extrabold tracking-wide text-[#B8C6D6] uppercase">Discount (£)<input value={discount} onChange={(event) => setDiscount(event.target.value)} inputMode="decimal" className="mt-2 min-h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 font-bold text-white" /></label><div className="mt-5 border-t border-white/20 pt-4"><Money label="Total GBP" value={totals?.totalPence} large /></div><p className="mt-3 text-xs text-[#B8C6D6]">VAT is not shown because no approved VAT configuration exists.</p></div></div>
    </FormSection>
    <FormSection title="Terms and notes"><div className="grid gap-4 sm:grid-cols-2"><TextField name="payment_terms" title="Payment terms" value={initial.paymentTerms} /><TextField name="notes" title="Notes" value={initial.notes} /></div></FormSection>
    <div className="flex justify-end"><button disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1974E2] px-6 text-sm font-extrabold text-white disabled:opacity-60"><Save size={18} />{pending ? "Saving…" : initial.id ? "Save changes" : "Save draft"}</button></div>
  </form>;
}

function FormSection({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-extrabold text-[#071127]">{title}</h2>{aside}</div>{children}</section>; }
function Field({ name, title, value, type = "text", required = false, upper = false }: { name: string; title: string; value: string; type?: string; required?: boolean; upper?: boolean }) { return <label className={label}>{title}<input name={name} type={type} defaultValue={value} required={required} className={`${input} ${upper ? "uppercase" : ""}`} /></label>; }
function ServiceField({ value }: { value: string }) { const current = value.trim(); const canonical = invoiceServiceOptions.find((option) => option.toLocaleLowerCase("en-GB") === current.toLocaleLowerCase("en-GB")); const selected = canonical || current; return <label className={label}>Service<select name="service_name" defaultValue={selected} className={input}><option value="">Select a service</option>{current && !canonical && <option value={current}>{current} (current)</option>}{invoiceServiceOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function TextField({ name, title, value }: { name: string; title: string; value: string }) { return <label className={label}>{title}<textarea name={name} defaultValue={value} rows={4} className={`${input} py-3`} /></label>; }
function EditableField({ title, value, change }: { title: string; value: string; change: (value: string) => void }) { return <label className={label}>{title}<input value={value} onChange={(event) => change(event.target.value)} inputMode={title === "Description" ? undefined : "decimal"} required className={input} /></label>; }
function Money({ label: text, value, large = false }: { label: string; value?: bigint; large?: boolean }) { return <div className={`flex justify-between gap-4 ${large ? "text-lg font-extrabold" : "text-sm"}`}><span>{text}</span><span>{value == null ? "—" : formatPence(value)}</span></div>; }
function safePence(value: string) { try { return poundsToPence(value || "0").toString(); } catch { return "-1"; } }
function update(setter: React.Dispatch<React.SetStateAction<EditableItem[]>>, key: string, name: keyof Omit<EditableItem, "key">, value: string) { setter((items) => items.map((item) => item.key === key ? { ...item, [name]: value } : item)); }
function hydratePayload(form: HTMLFormElement, payload: Record<string, unknown>) { const data = new FormData(form); const hydrated = { ...payload }; for (const key of ["customer_name", "customer_email", "customer_phone", "customer_address", "vehicle_registration", "vehicle_make", "vehicle_model", "service_name", "issue_date", "due_date", "notes", "payment_terms"]) hydrated[key] = String(data.get(key) || ""); (form.elements.namedItem("payload") as HTMLInputElement).value = JSON.stringify(hydrated); }
