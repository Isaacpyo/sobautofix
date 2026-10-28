import { ArrowLeft, CalendarPlus, ChevronRight, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotPermitted, SchemaMissingNotice } from "@/components/admin/diary/diary-states";
import { getCustomerDetail } from "@/lib/customers/repository";
import { formatLondonDateTime } from "@/lib/diary/time";
import { appointmentStatusLabels, diaryTypeLabels, isAppointmentKind, isAppointmentStatus } from "@/lib/diary/types";
import { requireStaffPage } from "@/lib/exchange/staff";

export const metadata: Metadata = { title: "Customer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

function words(value: string | null | undefined) {
  if (!value) return "";
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

const enquiryTypes: Record<string, string> = { vehicle_sales: "Sales enquiry", vehicle_purchase: "Buying enquiry" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff, allowed } = await requireStaffPage("customers.view");
  if (!allowed) return <NotPermitted what="customer details" />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detail = await getCustomerDetail(staff.client, id);
  if (!detail) notFound();
  const { customer } = detail;

  const sections: Array<{ id: string; title: string; empty: string; rows: Array<{ key: string; href: string; title: string; detail: string; badge?: string }> }> = [
    {
      id: "appointments",
      title: "Appointments",
      empty: "No diary appointments.",
      rows: detail.appointments.map((row) => ({ key: row.id, href: row.href, title: row.title, detail: `${isAppointmentKind(row.kind) ? diaryTypeLabels[row.kind] : "Appointment"} · ${formatLondonDateTime(row.start)}`, badge: isAppointmentStatus(row.status) ? appointmentStatusLabels[row.status] : words(row.status) })),
    },
    {
      id: "enquiries",
      title: "Enquiries",
      empty: "No enquiries.",
      rows: detail.enquiries.map((row) => ({ key: row.id, href: row.href, title: enquiryTypes[row.type] ?? `${words(row.type)} enquiry`, detail: [row.vehicle, `received ${dateFormat.format(new Date(row.createdAt))}`].filter(Boolean).join(" · "), badge: row.salesStage ? words(row.salesStage) : words(row.status) })),
    },
    {
      id: "submissions",
      title: "Cars offered to us",
      empty: "No seller submissions.",
      rows: detail.submissions.map((row) => ({ key: row.id, href: row.href, title: `${row.reference} · ${row.vehicle}`, detail: `Submitted ${dateFormat.format(new Date(row.createdAt))}`, badge: words(row.status) })),
    },
    {
      id: "bookings",
      title: "Workshop bookings",
      empty: "No workshop bookings.",
      rows: detail.bookings.map((row) => ({ key: row.id, href: row.href, title: `${row.reference} · ${row.service}`, detail: [row.vehicle, formatLondonDateTime(row.start)].filter(Boolean).join(" · "), badge: words(row.status) })),
    },
    {
      id: "sales",
      title: "Cars bought from us",
      empty: "No vehicle sales.",
      rows: detail.sales.map((row) => ({ key: row.id, href: row.href, title: row.vehicle ?? "Vehicle sale", detail: `Reserved ${dateFormat.format(new Date(row.reservedAt))}`, badge: words(row.status) })),
    },
  ];

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5">
      <Link href="/admin/customers" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-bold text-[#1462C4] hover:underline"><ArrowLeft size={17} aria-hidden="true" /> All customers</Link>
      <header className="grid grid-cols-1 gap-3 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:p-6">
        <p className="text-xs font-extrabold tracking-widest text-[#1462C4] uppercase">Customer</p>
        <h1 className={customer.anonymised ? "text-3xl font-extrabold text-[#5B6575]" : "text-3xl font-extrabold text-[#0B1220]"}>{customer.name}</h1>
        {customer.anonymised ? (
          <p className="text-sm text-[#344054]">This customer&apos;s details were removed under the retention policy. Their linked records are kept for the business record.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customer.phone && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#BCD6F6] px-3 text-sm font-bold text-[#1462C4] hover:bg-[#F5F9FF]"><Phone size={16} aria-hidden="true" /> {customer.phone}</a>}
            {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-[#BCD6F6] px-3 text-sm font-bold break-all text-[#1462C4] hover:bg-[#F5F9FF]"><Mail size={16} className="shrink-0" aria-hidden="true" /> {customer.email}</a>}
            {!customer.phone && !customer.email && <p className="text-sm text-[#5B6575]">No contact details recorded.</p>}
          </div>
        )}
        <p className="text-sm text-[#5B6575]">{customer.preferredContact ? `Prefers ${words(customer.preferredContact).toLowerCase()} · ` : ""}First contact {dateFormat.format(new Date(customer.createdAt))}</p>
        {!customer.anonymised && (
          <Link href={`/admin/diary/new?customer=${customer.id}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-bold text-white hover:bg-[#1462C4] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]"><CalendarPlus size={17} aria-hidden="true" /> New appointment</Link>
        )}
      </header>

      {detail.schemaMissing && <SchemaMissingNotice />}

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`${section.id}-heading`} className="grid grid-cols-1 gap-2">
          <h2 id={`${section.id}-heading`} className="text-lg font-extrabold text-[#0B1220]">{section.title} <span className="text-sm font-bold text-[#5B6575]">({section.rows.length})</span></h2>
          {section.rows.length ? (
            <ul className="grid grid-cols-1 gap-2">
              {section.rows.map((row) => (
                <li key={row.key}>
                  <Link href={row.href} className="flex min-h-14 items-center gap-3 rounded-xl border border-[#E3E8EF] bg-white px-4 py-2.5 hover:border-[#1974E2] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-[#0B1220]">{row.title}</span>
                      <span className="block text-sm text-[#5B6575]">{row.detail}</span>
                    </span>
                    {row.badge && <span className="shrink-0 rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-xs font-bold text-[#344054]">{row.badge}</span>}
                    <ChevronRight size={18} className="shrink-0 text-[#1974E2]" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-4 py-3 text-sm text-[#5B6575]">{section.empty}</p>}
        </section>
      ))}
    </div>
  );
}
