import { CalendarClock, ChevronRight, FilePlus2, Inbox, ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceForm, type ExistingSourceInvoice, type InvoiceFormInitial } from "@/components/admin/invoice-form";
import { InvoiceDraftsWorkspace, type InvoiceDraftSummary } from "@/components/admin/invoice-drafts-workspace";
import { BackLink } from "@/components/ui/back-link";
import { createAdminReadClient } from "@/lib/supabase/server";
import { formatRegistration } from "@/lib/vehicle/registration-format";

type Customer = { name: string; email: string | null; phone: string };
type Vehicle = { registration: string | null; make: string | null; model: string | null };
type Booking = { id: string; booking_reference: string; status: string; service_name: string; appointment_start: string; customer_id: string; vehicle_id: string; customers: Customer | Customer[] | null; vehicles: Vehicle | Vehicle[] | null };
type Enquiry = { id: string; type: string; service_slug: string | null; description: string | null; created_at: string; customer_id: string; vehicle_id: string | null; customers: Customer | Customer[] | null; vehicles: Vehicle | Vehicle[] | null };
type InvoiceDraft = { id: string; customer_name: string; service_name: string | null; vehicle_registration: string | null; vehicle_make: string | null; vehicle_model: string | null; updated_at: string };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ source?: string; bookingId?: string; enquiryId?: string; q?: string }> }) {
  const params = await searchParams;
  const client = await createAdminReadClient();
  const source = params.source;
  let selected: InvoiceFormInitial | null = source === "manual" ? emptyInvoice("manual") : null;
  let bookingRows: Booking[] = [];
  let enquiryRows: Enquiry[] = [];
  let existingSourceIds = new Set<string>();
  let existingSourceInvoices: ExistingSourceInvoice[] = [];
  let invoiceDrafts: InvoiceDraftSummary[] = [];

  if (client && source === "booking") {
    if (params.bookingId) {
      const [{ data: booking, error: bookingError }, { data: existing, error: existingError }] = await Promise.all([
        client.from("bookings").select("id,booking_reference,status,service_name,appointment_start,customer_id,vehicle_id,customers(name,email,phone),vehicles(registration,make,model)").eq("id", params.bookingId).neq("status", "cancelled").maybeSingle(),
        client.from("invoices").select("id,invoice_number,status").eq("booking_id", params.bookingId).order("created_at", { ascending: false }),
      ]);
      if (bookingError || existingError) throw new Error("Invoice source history could not be loaded safely.");
      if (!booking) notFound();
      selected = fromBooking(booking as unknown as Booking);
      existingSourceInvoices = (existing || []).map((invoice) => ({ id: invoice.id, reference: invoice.invoice_number || "Draft invoice", status: invoice.status }));
    } else {
      const [{ data, error: bookingError }, { data: existing, error: existingError }, { data: drafts, error: draftsError }] = await Promise.all([
        client.from("bookings").select("id,booking_reference,status,service_name,appointment_start,customer_id,vehicle_id,customers(name,email,phone),vehicles(registration,make,model)").neq("status", "cancelled").order("appointment_start", { ascending: false }).limit(250),
        client.from("invoices").select("booking_id").not("booking_id", "is", null),
        client.from("invoices").select("id,customer_name,service_name,vehicle_registration,vehicle_make,vehicle_model,updated_at").eq("status", "draft").order("updated_at", { ascending: false }),
      ]);
      if (bookingError || existingError || draftsError) throw new Error("Invoice source history could not be loaded safely.");
      bookingRows = (data || []) as unknown as Booking[];
      existingSourceIds = new Set((existing || []).map((row) => row.booking_id).filter(Boolean) as string[]);
      invoiceDrafts = ((drafts || []) as InvoiceDraft[]).map((draft) => ({
        id: draft.id,
        customerName: draft.customer_name || "Unnamed customer",
        serviceName: draft.service_name || "Service not specified",
        vehicleLabel: [draft.vehicle_make, draft.vehicle_model, draft.vehicle_registration ? formatRegistration(draft.vehicle_registration) : null].filter(Boolean).join(" · ") || "No vehicle",
        updatedLabel: formatDateTime(draft.updated_at),
      }));
    }
  }

  if (client && source === "enquiry") {
    if (params.enquiryId) {
      const [{ data: enquiry, error: enquiryError }, { data: existing, error: existingError }] = await Promise.all([
        client.from("enquiries").select("id,type,service_slug,description,created_at,customer_id,vehicle_id,customers(name,email,phone),vehicles(registration,make,model)").eq("id", params.enquiryId).maybeSingle(),
        client.from("invoices").select("id,invoice_number,status").eq("enquiry_id", params.enquiryId).order("created_at", { ascending: false }),
      ]);
      if (enquiryError || existingError) throw new Error("Invoice source history could not be loaded safely.");
      if (!enquiry) notFound();
      selected = fromEnquiry(enquiry as unknown as Enquiry);
      existingSourceInvoices = (existing || []).map((invoice) => ({ id: invoice.id, reference: invoice.invoice_number || "Draft invoice", status: invoice.status }));
    } else {
      const [{ data, error: enquiryError }, { data: existing, error: existingError }] = await Promise.all([
        client.from("enquiries").select("id,type,service_slug,description,created_at,customer_id,vehicle_id,customers(name,email,phone),vehicles(registration,make,model)").order("created_at", { ascending: false }).limit(250),
        client.from("invoices").select("enquiry_id").not("enquiry_id", "is", null),
      ]);
      if (enquiryError || existingError) throw new Error("Invoice source history could not be loaded safely.");
      enquiryRows = (data || []) as unknown as Enquiry[];
      existingSourceIds = new Set((existing || []).map((row) => row.enquiry_id).filter(Boolean) as string[]);
    }
  }

  if (selected) return <><Back /><Header title={source === "manual" ? "Manual invoice" : source === "booking" ? "Invoice from booking" : "Invoice from enquiry"} description="Confirm the snapshot details, add prices and save a draft. No invoice number is consumed until issue." /><InvoiceForm initial={selected} existingSourceInvoices={existingSourceInvoices} /></>;

  if (source === "booking") return <><Back /><InvoiceDraftsWorkspace drafts={invoiceDrafts} header={<Header title="Choose a booking" description="Select a locally persisted appointment. Creating an invoice remains a deliberate admin action." />}><SourceSearch source="booking" query={params.q || ""} />
    <div className="mt-6 grid gap-4">{filterBookings(bookingRows, params.q).map((booking) => { const customer = relation(booking.customers); const vehicle = relation(booking.vehicles); return <article key={booking.id} className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="font-mono text-sm font-black text-[#1974E2]">{booking.booking_reference}</p><h2 className="mt-2 text-xl font-extrabold text-[#071127]">{customer?.name || "Customer"}</h2><p className="mt-2 font-semibold text-[#586575]">{booking.service_name}</p><p className="mt-1 text-sm text-[#667586]">{formatDateTime(booking.appointment_start)} · {vehicleLabel(vehicle)} · {customer?.email || customer?.phone || "No contact"}</p>{existingSourceIds.has(booking.id) && <p className="mt-3 text-sm font-bold text-amber-800">An invoice already exists for this booking. Continuing will deliberately create another draft.</p>}</div><Link href={`/admin/invoices/new?source=booking&bookingId=${booking.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-extrabold text-white">Create invoice <ChevronRight size={17} /></Link></div></article>; })}{!bookingRows.length && <Empty text="No eligible persisted bookings are available. Manual invoicing is still available." />}</div></InvoiceDraftsWorkspace></>;

  if (source === "enquiry") return <><Back /><Header title="Choose an enquiry" description="Use an existing customer request to prefill a draft invoice." /><SourceSearch source="enquiry" query={params.q || ""} />
    <div className="mt-6 grid gap-4">{filterEnquiries(enquiryRows, params.q).map((enquiry) => { const customer = relation(enquiry.customers); const vehicle = relation(enquiry.vehicles); return <article key={enquiry.id} className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-extrabold tracking-wide text-[#1974E2] uppercase">{enquiry.type.replaceAll("_", " ")}</p><h2 className="mt-2 text-xl font-extrabold text-[#071127]">{customer?.name || "Customer"}</h2><p className="mt-1 text-sm text-[#667586]">{vehicleLabel(vehicle)} · {formatDate(enquiry.created_at)}</p>{enquiry.description && <p className="mt-3 line-clamp-2 max-w-3xl text-sm text-[#586575]">{enquiry.description}</p>}{existingSourceIds.has(enquiry.id) && <p className="mt-3 text-sm font-bold text-amber-800">An invoice already exists for this enquiry. Continuing will deliberately create another draft.</p>}</div><Link href={`/admin/invoices/new?source=enquiry&enquiryId=${enquiry.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-extrabold text-white">Create invoice <ChevronRight size={17} /></Link></div></article>; })}</div></>;

  return <><Back /><Header title="Add invoice" description="Choose how this invoice should be created." /><section className="mt-8 grid gap-5 lg:grid-cols-3"><Choice href="/admin/invoices/new?source=booking" icon={CalendarClock} title="From booking" text="Choose a persisted garage appointment and prefill customer, vehicle and service details." /><Choice href="/admin/invoices/new?source=manual" icon={FilePlus2} title="Manual invoice" text="Create an invoice without a booking and enter all customer and vehicle details." /><Choice href="/admin/invoices/new?source=enquiry" icon={Inbox} title="From enquiry" text="Use an existing enquiry as the source while keeping price confirmation explicit." /></section></>;
}

function emptyInvoice(sourceType: InvoiceFormInitial["sourceType"]): InvoiceFormInitial { const issue = new Date().toISOString().slice(0, 10); const due = new Date(); due.setUTCDate(due.getUTCDate() + 7); return { sourceType, customerName: "", customerEmail: "", customerPhone: "", customerAddress: "", vehicleRegistration: "", vehicleMake: "", vehicleModel: "", serviceName: "", appointmentStart: "", issueDate: issue, dueDate: due.toISOString().slice(0, 10), discount: "0.00", notes: "", paymentTerms: "Payment due within 7 days.", items: [{ description: "", quantity: "1", unitPrice: "0.00" }] }; }
function fromBooking(booking: Booking): InvoiceFormInitial { const customer = relation(booking.customers); const vehicle = relation(booking.vehicles); return { ...emptyInvoice("booking"), bookingId: booking.id, customerId: booking.customer_id, vehicleId: booking.vehicle_id, customerName: customer?.name || "", customerEmail: customer?.email || "", customerPhone: customer?.phone || "", vehicleRegistration: vehicle?.registration || "", vehicleMake: vehicle?.make || "", vehicleModel: vehicle?.model || "", serviceName: booking.service_name, appointmentStart: booking.appointment_start, items: [{ description: booking.service_name, quantity: "1", unitPrice: "0.00" }] }; }
function fromEnquiry(enquiry: Enquiry): InvoiceFormInitial { const customer = relation(enquiry.customers); const vehicle = relation(enquiry.vehicles); const service = enquiry.service_slug?.replaceAll("-", " ") || enquiry.type.replaceAll("_", " "); return { ...emptyInvoice("enquiry"), enquiryId: enquiry.id, customerId: enquiry.customer_id, vehicleId: enquiry.vehicle_id || undefined, customerName: customer?.name || "", customerEmail: customer?.email || "", customerPhone: customer?.phone || "", vehicleRegistration: vehicle?.registration || "", vehicleMake: vehicle?.make || "", vehicleModel: vehicle?.model || "", serviceName: service, notes: enquiry.description || "", items: [{ description: service, quantity: "1", unitPrice: "0.00" }] }; }
function Header({ title, description }: { title: string; description: string }) { return <header className="mt-5 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><ReceiptText size={23} /></span><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Invoices</p><h1 className="mt-1 text-4xl font-extrabold text-[#071127]">{title}</h1><p className="mt-2 max-w-2xl text-[#667586]">{description}</p></div></header>; }
function Back() { return <BackLink href="/admin/invoices">Back to invoices</BackLink>; }
function Choice({ href, icon: Icon, title, text }: { href: string; icon: typeof CalendarClock; title: string; text: string }) { return <Link href={href} className="group rounded-2xl border border-[#E4EAF0] bg-white p-6 transition hover:border-[#1974E2] hover:shadow-lg"><span className="grid size-12 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><Icon size={23} /></span><h2 className="mt-5 text-2xl font-extrabold text-[#071127]">{title}</h2><p className="mt-2 leading-6 text-[#667586]">{text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#1974E2]">Continue <ChevronRight size={17} /></span></Link>; }
function SourceSearch({ source, query }: { source: string; query: string }) { return <form className="mt-6 flex gap-3 rounded-2xl border border-[#E4EAF0] bg-white p-4"><input type="hidden" name="source" value={source} /><input name="q" defaultValue={query} placeholder="Search customer, booking, vehicle or service…" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#D7E0E9] px-4 text-sm" /><button className="rounded-xl bg-[#071127] px-5 text-sm font-extrabold text-white">Search</button></form>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-[#E4EAF0] bg-white p-10 text-center text-[#667586]">{text}</div>; }
function relation<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] || null : value; }
function vehicleLabel(vehicle: Vehicle | null) { return [vehicle?.make, vehicle?.model, vehicle?.registration ? formatRegistration(vehicle.registration) : null].filter(Boolean).join(" · ") || "No vehicle"; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value)); }
function filterBookings(rows: Booking[], query?: string) { if (!query) return rows; const q = query.toLowerCase(); return rows.filter((row) => [row.booking_reference, row.service_name, relation(row.customers)?.name, relation(row.customers)?.email, relation(row.vehicles)?.registration].filter(Boolean).join(" ").toLowerCase().includes(q)); }
function filterEnquiries(rows: Enquiry[], query?: string) { if (!query) return rows; const q = query.toLowerCase(); return rows.filter((row) => [row.type, row.service_slug, row.description, relation(row.customers)?.name, relation(row.customers)?.email, relation(row.vehicles)?.registration].filter(Boolean).join(" ").toLowerCase().includes(q)); }
