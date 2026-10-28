import { randomUUID } from "node:crypto";
import { CalendarPlus, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnquiryReplyComposer } from "@/components/admin/enquiry-reply-composer";
import { EnquiryThread } from "@/components/admin/exchange/enquiry-thread";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/admin/exchange/forms";
import { formatDateTime, formatPounds, label, preferredContactLabels, salesStageLabels, salesStageTones, toLocalInput, vehicleSaleStatusLabels, vehicleSaleStatusTones } from "@/components/admin/exchange/labels";
import { ReserveForm } from "@/components/admin/exchange/reserve-form";
import { Badge, Card, LinkButton, NoAccess, Notice } from "@/components/admin/exchange/ui";
import { BackLink } from "@/components/ui/back-link";
import { listStaff } from "@/lib/exchange/admin/core";
import { getSalesEnquiry, manualStages } from "@/lib/exchange/admin/sales";
import { formatPence } from "@/lib/exchange/margin";
import { requireStaffPage } from "@/lib/exchange/staff";
import { saveExchangeNoteAction, sendExchangeReplyAction } from "../../thread-actions";
import { updateSalesEnquiryAction } from "../actions";

export default async function SalesEnquiryPage({ params }: { params: Promise<{ enquiryId: string }> }) {
  const { staff, allowed } = await requireStaffPage("sales.manage");
  if (!allowed) return <NoAccess area="sales enquiries" />;
  const { enquiryId } = await params;
  const [detail, staffList] = await Promise.all([getSalesEnquiry(staff, enquiryId), listStaff(staff.client)]);
  if (!detail) notFound();
  const { enquiry } = detail;
  const vehicle = enquiry.sale_vehicles;
  const customer = enquiry.customers;
  const stageOptions = (enquiry.stage === "reserved" || enquiry.stage === "sold" ? [enquiry.stage] : manualStages).map((value) => ({ value, label: salesStageLabels[value] }));
  const whatsapp = customer?.phone.replace(/[^+\d]/g, "").replace(/^\+/, "") || "";
  const reservedElsewhere = detail.vehicleActiveSale && detail.vehicleActiveSale.enquiry_id !== enquiry.id;
  const ownSale = detail.sales.find((sale) => sale.status !== "cancelled");

  return <>
    <BackLink href="/admin/exchange/sales">Back to Sales Enquiries</BackLink>
    <header className="mt-3 rounded-xl border border-[#E4EAF0] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={salesStageTones[enquiry.stage]}>{salesStageLabels[enquiry.stage]}</Badge>{enquiry.source === "staff" && <Badge>Added by staff</Badge>}{enquiry.notification_status === "failed" && <Badge tone="danger">Notification failed</Badge>}</div>
      <h2 className="mt-2 text-2xl font-extrabold text-[#071127] sm:text-3xl">{customer?.name || "Customer"}</h2>
      <p className="text-sm text-[#586575]">Enquiry received {formatDateTime(enquiry.created_at)}</p>
      {customer && <div className="mt-3 flex flex-wrap gap-2">
        <a href={`tel:${customer.phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold"><Phone size={15} aria-hidden="true" />{customer.phone}</a>
        {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold break-all"><Mail size={15} aria-hidden="true" />{customer.email}</a>}
        {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold"><MessageCircle size={15} aria-hidden="true" />WhatsApp</a>}
        <span className="inline-flex min-h-10 items-center text-xs text-[#586575]">Prefers {label(preferredContactLabels, customer.preferred_contact, "phone")}</span>
      </div>}
    </header>

    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 gap-4">
        <EnquiryThread messages={detail.thread} />
        <EnquiryReplyComposer enquiryId={enquiry.id} customerEmail={customer?.email || null} initialClientRequestId={randomUUID()} replyAction={sendExchangeReplyAction} noteAction={saveExchangeNoteAction} />
      </div>
      <aside className="grid min-w-0 gap-4" aria-label="Enquiry details">
        <Card title="Progress">
          <ActionForm action={updateSalesEnquiryAction} hidden={{ enquiryId: enquiry.id }}>
            <div className="grid gap-3">
              <SelectField name="stage" label="Stage" defaultValue={enquiry.stage} options={stageOptions} hint={enquiry.stage === "reserved" || enquiry.stage === "sold" ? "Follows the reservation in Sales & Handover." : "Reserved and Sold are set by the reservation."} />
              <SelectField name="assignedTo" label="Assigned to" defaultValue={enquiry.assigned_to || ""} placeholder="Unassigned" options={staffList.map((member) => ({ value: member.id, label: member.name }))} />
              <TextField name="followUpAt" label="Follow up on" type="datetime-local" defaultValue={toLocalInput(enquiry.follow_up_at)} hint="UK time. Overdue follow-ups show in Overview." />
            </div>
            <div className="mt-3 flex justify-end"><SubmitButton>Save</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card title="Vehicle">
          {vehicle ? <>
            <Link href={`/admin/exchange/stock/${vehicle.id}`} className="font-extrabold text-[#071127] hover:text-[#1462C4]">{vehicle.year} {vehicle.make} {vehicle.model}</Link>
            <p className="text-sm text-[#586575]">{vehicle.stock_reference} · {formatPounds(vehicle.price)} · <span className="capitalize">{vehicle.status === "archived" ? "Withdrawn" : vehicle.status}</span></p>
            {ownSale ? <div className="mt-3 rounded-lg bg-[#F4F7FA] p-3 text-sm"><p className="flex flex-wrap items-center gap-2 font-bold text-[#071127]">Reserved for this customer <Badge tone={vehicleSaleStatusTones[ownSale.status as keyof typeof vehicleSaleStatusTones]}>{vehicleSaleStatusLabels[ownSale.status as keyof typeof vehicleSaleStatusLabels]}</Badge></p><p className="text-[#586575]">Agreed {formatPence(ownSale.agreed_price_pence)}</p><Link href={`/admin/exchange/handover/${ownSale.id}`} className="mt-1 inline-flex min-h-10 items-center font-extrabold text-[#1462C4]">Open in Sales &amp; Handover</Link></div>
              : reservedElsewhere ? <div className="mt-3"><Notice>This vehicle is reserved for another customer.</Notice></div>
              : vehicle.status === "available" ? <div className="mt-4 border-t border-[#EEF2F6] pt-4"><h4 className="mb-2 text-sm font-extrabold text-[#071127]">Reserve this vehicle</h4><ReserveForm vehicle={{ id: vehicle.id, title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, price: vehicle.price }} enquiryId={enquiry.id} canChangePrice={staff.can("stock.price")} partExchangeOptions={detail.partExchangeOptions} /></div>
              : <p className="mt-3 text-sm text-[#586575]">This vehicle is not available to reserve.</p>}
          </> : <p className="text-sm text-[#586575]">No vehicle is linked to this enquiry.</p>}
        </Card>

        <Card title="Viewings" actions={staff.can("diary.manage") && vehicle ? <LinkButton href={`/admin/diary/new?kind=viewing&enquiry=${enquiry.id}&vehicle=${vehicle.id}`} className="min-h-10"><CalendarPlus size={15} aria-hidden="true" />Book viewing</LinkButton> : undefined}>
          {detail.appointments.length ? <ul className="grid gap-2">{detail.appointments.map((appointment) => <li key={appointment.id}><Link href={`/admin/diary/${appointment.id}`} className="block rounded-lg border border-[#E4EAF0] p-3 hover:border-[#1974E2]">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold text-[#071127]">{formatDateTime(appointment.starts_at)}</span><Badge tone={appointment.status === "requested" ? "warning" : appointment.status === "confirmed" ? "success" : "neutral"}>{appointment.status === "requested" ? "Requested, not confirmed" : appointment.status}</Badge></div>
            {appointment.alternative_start && <p className="text-xs text-[#586575]">Alternative: {formatDateTime(appointment.alternative_start)}</p>}
            {appointment.customer_message && <p className="mt-1 text-xs text-[#344054]">“{appointment.customer_message}”</p>}
          </Link></li>)}</ul> : <p className="text-sm text-[#586575]">No viewings for this enquiry.</p>}
        </Card>
      </aside>
    </div>
  </>;
}
