import { ArrowLeftRight, CalendarPlus, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, CheckboxField, ConfirmButton, MoneyField, SelectField, SubmitButton, TextArea, TextField } from "@/components/admin/exchange/forms";
import { formatDate, formatDateTime, handoverMethodLabels, label, paymentStatuses, paymentStatusLabels, penceToInput, submissionStatusLabels, toLocalInput, vehicleSaleStatusLabels, vehicleSaleStatusTones, type SubmissionStatus } from "@/components/admin/exchange/labels";
import { Badge, Card, KeyValues, LinkButton, NoAccess, Notice } from "@/components/admin/exchange/ui";
import { BackLink } from "@/components/ui/back-link";
import { getSale } from "@/lib/exchange/admin/handover";
import { formatPence } from "@/lib/exchange/margin";
import { requireStaffPage } from "@/lib/exchange/staff";
import { cancelSaleAction, completeSaleAction, updateSaleAction } from "../../sales/actions";

export default async function HandoverDetailPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { staff, allowed } = await requireStaffPage("sales.manage");
  if (!allowed) return <NoAccess area="sales and handover" />;
  const { saleId } = await params;
  const detail = await getSale(staff, saleId);
  if (!detail) notFound();
  const { sale } = detail;
  const vehicle = sale.sale_vehicles;
  const title = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle";
  const active = ["reserved", "awaiting_payment", "ready_for_handover"].includes(sale.status);
  const balance = sale.agreed_price_pence - (sale.part_exchange_allowance_pence ?? 0) - sale.amount_paid_pence;
  const canPrice = staff.can("stock.price");

  return <>
    <BackLink href="/admin/exchange/handover">Back to Sales &amp; Handover</BackLink>
    <header className="mt-3 rounded-xl border border-[#E4EAF0] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Badge tone={vehicleSaleStatusTones[sale.status]}>{vehicleSaleStatusLabels[sale.status]}</Badge><h2 className="mt-2 text-2xl font-extrabold text-[#071127] sm:text-3xl">{title}</h2><p className="text-sm text-[#586575]">{vehicle?.stock_reference}{sale.customers ? ` · ${sale.customers.name}` : ""} · Reserved {formatDateTime(sale.reserved_at)}</p></div>
        <div className="text-right"><p className="text-3xl font-extrabold text-[#071127]">{formatPence(sale.agreed_price_pence)}</p><p className="text-xs font-semibold text-[#586575]">{balance > 0 ? `${formatPence(balance)} still to pay` : "Nothing left to pay"}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {vehicle && <LinkButton href={`/admin/exchange/stock/${vehicle.id}`} className="min-h-10">Open stock record</LinkButton>}
        {sale.enquiry_id && <LinkButton href={`/admin/exchange/sales/${sale.enquiry_id}`} className="min-h-10">Open sales enquiry</LinkButton>}
        {active && staff.can("diary.manage") && <LinkButton href={`/admin/diary/new?kind=handover&sale=${sale.id}`} className="min-h-10"><CalendarPlus size={15} aria-hidden="true" />Book handover</LinkButton>}
      </div>
    </header>

    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 gap-4">
        {active ? <Card title="Payment and handover" description="Record what has been agreed and paid. Payments are taken outside this system.">
          <ActionForm action={updateSaleAction} hidden={{ saleId: sale.id }}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField name="status" label="Stage" defaultValue={sale.status} options={(["reserved", "awaiting_payment", "ready_for_handover"] as const).map((value) => ({ value, label: vehicleSaleStatusLabels[value] }))} />
              <MoneyField name="agreedPrice" label="Agreed price" defaultValue={penceToInput(sale.agreed_price_pence)} required readOnly={!canPrice} hint={canPrice ? undefined : "Only an owner or manager can change the agreed price."} />
              <MoneyField name="deposit" label="Deposit" defaultValue={penceToInput(sale.deposit_pence)} />
              <MoneyField name="amountPaid" label="Total paid so far" defaultValue={penceToInput(sale.amount_paid_pence)} hint="Including the deposit." />
              <SelectField name="paymentStatus" label="Payment status" defaultValue={sale.payment_status} options={paymentStatuses.map((value) => ({ value, label: paymentStatusLabels[value] }))} />
              <TextField name="paymentMethod" label="Payment method" defaultValue={sale.payment_method} />
              <TextField name="reservationExpiresAt" label="Reservation ends" type="datetime-local" defaultValue={toLocalInput(sale.reservation_expires_at)} />
              {sale.part_exchange_submission_id ? <MoneyField name="partExchangeAllowance" label="Part-exchange allowance" defaultValue={penceToInput(sale.part_exchange_allowance_pence)} /> : <div className="hidden md:block" />}
              <SelectField name="handoverMethod" label="Handover" defaultValue={sale.handover_method} options={Object.entries(handoverMethodLabels).map(([value, text]) => ({ value, label: text }))} />
              <TextField name="handoverAt" label="Handover date and time" type="datetime-local" defaultValue={toLocalInput(sale.handover_at)} />
              <TextArea className="md:col-span-2" name="handoverNotes" label="Handover notes" rows={3} defaultValue={sale.handover_notes} hint="Staff only." />
            </div>
            <div className="mt-4 flex justify-end"><SubmitButton>Save sale details</SubmitButton></div>
          </ActionForm>
        </Card> : <Card title="Sale record">
          <KeyValues columns={2} items={[
            { label: "Agreed price", value: formatPence(sale.agreed_price_pence) }, { label: "Paid", value: formatPence(sale.amount_paid_pence) },
            { label: "Payment", value: label(paymentStatusLabels, sale.payment_status) }, { label: "Method", value: sale.payment_method || "Not recorded" },
            { label: "Handover", value: `${label(handoverMethodLabels, sale.handover_method)}${sale.handover_at ? `, ${formatDateTime(sale.handover_at)}` : ""}` },
            { label: sale.status === "completed" ? "Completed" : "Cancelled", value: formatDateTime(sale.completed_at || sale.cancelled_at) },
            ...(sale.cancellation_reason ? [{ label: "Reason", value: sale.cancellation_reason }] : []),
            ...(sale.handover_notes ? [{ label: "Notes", value: sale.handover_notes }] : []),
          ]} />
        </Card>}
        {detail.appointments.length > 0 && <Card title="Appointments"><ul className="grid gap-2">{detail.appointments.map((appointment) => <li key={appointment.id}><Link href={`/admin/diary/${appointment.id}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-[#E4EAF0] p-3 text-sm hover:border-[#1974E2]"><span className="font-bold">{appointment.title}</span><span className="text-[#586575]">{formatDateTime(appointment.starts_at)} · {appointment.status}</span></Link></li>)}</ul></Card>}
      </div>

      <aside className="grid min-w-0 gap-4" aria-label="Complete or cancel">
        {detail.partExchange && <Card title={<span className="flex items-center gap-2"><ArrowLeftRight size={17} aria-hidden="true" />Part exchange</span>}>
          <Link href={`/admin/exchange/buying/${detail.partExchange.id}`} className="font-bold text-[#1462C4]">{detail.partExchange.reference} · {[detail.partExchange.year, detail.partExchange.make, detail.partExchange.model].filter(Boolean).join(" ")}</Link>
          <p className="text-sm text-[#586575]">{submissionStatusLabels[detail.partExchange.status as SubmissionStatus] || detail.partExchange.status}{sale.part_exchange_allowance_pence != null ? ` · allowance ${formatPence(sale.part_exchange_allowance_pence)}` : ""}</p>
        </Card>}
        {active && <Card title="Complete the sale" description="Do this at handover, once payment is in full. The vehicle is marked Sold on the website straight away.">
          {sale.payment_status === "paid_in_full"
            ? <ActionForm action={completeSaleAction} hidden={{ saleId: sale.id }}><ConfirmButton variant="primary" tone="warning" className="w-full" title="Complete this sale?" message={`Record the ${title} as sold to this customer for ${formatPence(sale.agreed_price_pence)}? The listing shows a sold banner for 90 days.`} confirmLabel="Complete sale"><CheckCircle2 size={16} aria-hidden="true" />Complete sale</ConfirmButton></ActionForm>
            : <Notice tone="info">Set the payment status to Paid in full first.</Notice>}
        </Card>}
        {active && <Card title="Cancel the reservation" description="The vehicle goes back to Available on the website.">
          <ActionForm action={cancelSaleAction} hidden={{ saleId: sale.id }}>
            <TextArea name="reason" label="Reason" rows={2} required />
            <CheckboxField className="mt-3" name="markLost" label="The buyer is no longer interested" hint="Marks the sales enquiry as Lost." />
            <div className="mt-3 flex justify-end"><ConfirmButton title="Cancel this reservation?" message="The vehicle becomes Available again and can be reserved by someone else. Any deposit refund is handled outside this system." confirmLabel="Cancel reservation">Cancel reservation</ConfirmButton></div>
          </ActionForm>
        </Card>}
        {sale.status === "completed" && <Notice tone="success">Sale completed {formatDate(sale.completed_at)}. The vehicle is marked as sold.</Notice>}
      </aside>
    </div>
  </>;
}
