import { randomUUID } from "node:crypto";
import { Download, FilePenLine, Mail, ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { InvoiceStatusBadge } from "@/components/admin/invoice-status-badge";
import { BackLink } from "@/components/ui/back-link";
import { formatPence } from "@/lib/invoices/money";
import { getInvoiceEmailSendsForAdmin, getInvoiceForAdmin } from "@/lib/invoices/repository";
import { sourceLabel } from "@/lib/invoices/types";
import { createAdminReadClient as createClient } from "@/lib/supabase/server";
import { deleteDraftInvoiceAction, duplicateInvoiceAction, issueInvoiceAction, markInvoicePaidAction, sendInvoiceAction, voidInvoiceAction } from "../actions";

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; emailSendId?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const invoice = await getInvoiceForAdmin(id);
  if (!invoice) notFound();
  const emailSends = await getInvoiceEmailSendsForAdmin(id);
  const newEmailSendId = invoice.status === "issued" || invoice.status === "paid" ? randomUUID() : null;
  const hasEmailHistory = emailSends.length > 0;
  const hasPendingSend = emailSends.some((emailSend) => emailSend.status === "pending");
  const hasAmbiguousSend = emailSends.some((emailSend) => emailSend.status === "ambiguous" || emailSend.status === "pending");
  const client = await createClient();
  const { data: auditData } = client ? await client.from("admin_audit_log").select("id,action,created_at,detail").eq("entity_type", "invoice").eq("entity_id", id).order("created_at", { ascending: false }).limit(20) : { data: [] };
  const audit = (auditData || []) as Array<{ id: number; action: string; created_at: string; detail: Record<string, unknown> }>;
  const noticeText: Record<string, string> = { saved: "Draft invoice saved.", issued: `Invoice ${invoice.invoice_number || ""} issued.`, paid: "Invoice marked Paid / Settled.", voided: "Invoice voided; its number and record have been preserved.", sent: "Invoice email sent and recorded.", email_failed: "The provider rejected this email. You may retry the same logical send below.", email_pending: "This email send is already being processed. Refresh before taking another action.", email_reconcile: "Delivery is uncertain. Check Resend before deliberately sending another copy.", duplicated: "A new editable draft was created." };
  const noticeIsWarning = notice === "email_failed" || notice === "email_pending" || notice === "email_reconcile";
  return <>
    <BackLink href="/admin/invoices">Back to invoices</BackLink>
    {notice && noticeText[notice] && <p role="status" className={`mt-5 rounded-xl border p-4 text-sm font-bold ${noticeIsWarning ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-800"}`}>{noticeText[notice]}</p>}
    <header className="mt-5 rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-6"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><ReceiptText size={23} /></span><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">{sourceLabel(invoice.source_type)} invoice</p><h1 className="mt-1 text-3xl font-extrabold text-[#071127] sm:text-4xl">{invoice.invoice_number || "Draft invoice"}</h1><p className="mt-2 text-sm text-[#667586]">Created {formatDateTime(invoice.created_at)}</p></div></div><InvoiceStatusBadge status={invoice.status} /></div>
      <div className="mt-6 flex flex-wrap gap-2">{invoice.status === "draft" && <Link href={`/admin/invoices/${id}/edit`} className={primary}><FilePenLine size={17} /> Edit</Link>}<a href={`/api/admin/invoices/${id}/pdf?preview=1`} target="_blank" rel="noreferrer" className={secondary}>{invoice.status === "draft" ? "Preview PDF" : "View PDF"}</a><a href={`/api/admin/invoices/${id}/pdf`} className={secondary}><Download size={17} /> Download PDF</a></div>
    </header>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]"><main className="grid gap-6">
      <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-7"><h2 className="text-2xl font-extrabold text-[#071127]">Customer and vehicle</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Detail label="Customer" value={invoice.customer_name} /><Detail label="Email" value={invoice.customer_email || "—"} /><Detail label="Phone" value={invoice.customer_phone || "—"} /><Detail label="Address" value={invoice.customer_address || "—"} /><Detail label="Vehicle" value={[invoice.vehicle_make, invoice.vehicle_model].filter(Boolean).join(" ") || "—"} /><Detail label="Registration" value={invoice.vehicle_registration || "—"} /><Detail label="Service" value={invoice.service_name || "—"} /><Detail label="Appointment" value={invoice.appointment_start ? formatDateTime(invoice.appointment_start) : "—"} /></dl></section>
      <section className="overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white"><div className="p-5 sm:p-7"><h2 className="text-2xl font-extrabold text-[#071127]">Line items</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[#F4F7FA] text-xs font-extrabold tracking-wide text-[#586575] uppercase"><tr><th className="px-5 py-3">Description</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Unit price</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-[#E4EAF0]">{invoice.invoice_items.map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold text-[#071127]">{item.description}</td><td className="px-4 py-4 text-right">{trimQuantity(String(item.quantity))}</td><td className="px-4 py-4 text-right">{formatPence(item.unit_price_pence)}</td><td className="px-5 py-4 text-right font-extrabold">{formatPence(item.line_total_pence)}</td></tr>)}</tbody></table></div><dl className="ml-auto w-full max-w-sm p-5 sm:p-7"><Total label="Subtotal" value={invoice.subtotal_pence} />{BigInt(invoice.discount_pence) > 0n && <Total label="Discount" value={-BigInt(invoice.discount_pence)} />}{BigInt(invoice.tax_pence) > 0n && <Total label="Tax" value={invoice.tax_pence} />}<div className="mt-3 flex justify-between border-t-2 border-[#1974E2] pt-4 text-xl font-extrabold text-[#071127]"><dt>Total GBP</dt><dd>{formatPence(invoice.total_pence)}</dd></div></dl></section>
      {(invoice.notes || invoice.payment_terms) && <section className="grid gap-4 sm:grid-cols-2">{invoice.payment_terms && <TextBlock title="Payment terms" text={invoice.payment_terms} />}{invoice.notes && <TextBlock title="Notes" text={invoice.notes} />}</section>}
      <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-7"><h2 className="text-2xl font-extrabold text-[#071127]">Audit history</h2><div className="mt-4 grid gap-3">{audit.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4EAF0] pt-3 first:border-0 first:pt-0"><p className="font-bold text-[#071127]">{auditLabel(event.action)}</p><time className="text-xs text-[#667586]" dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></div>)}{!audit.length && <p className="text-sm text-[#667586]">No audit events are available yet.</p>}</div></section>
    </main><aside className="grid content-start gap-5">
      <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><h2 className="text-lg font-extrabold text-[#071127]">Invoice record</h2><dl className="mt-4 grid gap-4"><Detail label="Source" value={sourceLabel(invoice.source_type)} /><Detail label="Issue date" value={formatDate(invoice.issue_date)} /><Detail label="Due date" value={formatDate(invoice.due_date)} />{invoice.paid_at && <Detail label="Paid date" value={formatDate(invoice.paid_at.slice(0, 10))} />}{invoice.payment_method && <Detail label="Payment method" value={invoice.payment_method.replaceAll("_", " ")} />}{invoice.payment_reference && <Detail label="Payment reference" value={invoice.payment_reference} />}</dl></section>
      {hasEmailHistory && <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><h2 className="text-lg font-extrabold text-[#071127]">Email history</h2>{hasAmbiguousSend && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">A delivery is pending or uncertain. Do not retry it as a new send without checking Resend first.</p>}<div className="mt-4 grid gap-4">{emailSends.map((emailSend) => <article key={emailSend.id} className="border-t border-[#E4EAF0] pt-4 first:border-0 first:pt-0"><div className="flex items-center justify-between gap-3"><EmailSendStatus status={emailSend.status} /><time className="text-xs text-[#667586]" dateTime={emailSend.requested_at}>{formatDateTime(emailSend.requested_at)}</time></div><p className="mt-2 break-all text-sm font-semibold text-[#263446]">{emailSend.recipient}</p>{emailSend.status === "sent" && emailSend.sent_at && <p className="mt-1 text-xs text-[#667586]">Accepted by provider {formatDateTime(emailSend.sent_at)}</p>}{emailSend.status === "failed" && String(emailSend.invoice_revision) === String(invoice.revision) && emailSend.document_status === invoice.status && <form action={sendInvoiceAction} className="mt-3"><input type="hidden" name="invoiceId" value={id} /><input type="hidden" name="intent" value="retry" /><input type="hidden" name="logicalSendId" value={emailSend.id} /><input type="hidden" name="recipient" value={emailSend.recipient} /><ConfirmSubmitButton message="Retry this failed logical send with the same provider idempotency key?" className="min-h-10 w-full rounded-xl border border-[#C9D5E2] bg-white px-3 text-xs font-extrabold text-[#1446A5]">Retry failed send</ConfirmSubmitButton></form>}{emailSend.status === "failed" && (String(emailSend.invoice_revision) !== String(invoice.revision) || emailSend.document_status !== invoice.status) && <p className="mt-2 text-xs font-bold leading-5 text-[#667586]">This invoice has changed state. Create a deliberate new copy instead of retrying the old payload.</p>}{emailSend.status === "ambiguous" && <p className="mt-2 text-xs font-bold leading-5 text-amber-800">Reconciliation required; automatic retry is disabled.</p>}{emailSend.status === "pending" && <p className="mt-2 text-xs font-bold text-[#667586]">Processing; retry is disabled.</p>}</article>)}</div></section>}
      {invoice.status === "draft" && <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><h2 className="text-lg font-extrabold text-[#071127]">Draft actions</h2><p className="mt-2 text-sm text-[#667586]">Issuing validates the draft and atomically allocates the next number.</p><form action={issueInvoiceAction} className="mt-4"><input type="hidden" name="invoiceId" value={id} /><ConfirmSubmitButton message="Issue this invoice? Its financial details will become immutable." className={`${primary} w-full justify-center`}>Issue invoice</ConfirmSubmitButton></form><form action={deleteDraftInvoiceAction} className="mt-3"><input type="hidden" name="invoiceId" value={id} /><ConfirmSubmitButton message="Delete this draft invoice? This cannot be undone." className="min-h-11 w-full rounded-xl border border-red-200 text-sm font-extrabold text-red-700">Delete draft</ConfirmSubmitButton></form></section>}
      {invoice.status === "issued" && <>
        <InvoiceEmailSendPanel invoiceId={id} recipient={invoice.customer_email || ""} logicalSendId={newEmailSendId!} isCopy={hasEmailHistory} hasUncertainSend={hasAmbiguousSend} />
        {hasPendingSend
          ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-900">Payment and void actions are temporarily unavailable while an email send is in progress.</section>
          : <>
            <section id="payment" className="scroll-mt-20 rounded-2xl border border-[#E4EAF0] bg-white p-5"><h2 className="text-lg font-extrabold text-[#071127]">Mark Paid / Settled</h2><form action={markInvoicePaidAction} className="mt-4 grid gap-3"><input type="hidden" name="invoiceId" value={id} /><label className={formLabel}>Payment date<input required type="date" name="paidAt" defaultValue={new Date().toISOString().slice(0, 10)} className={input} /></label><label className={formLabel}>Method<select required name="method" className={input}><option value="card">Card</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label><label className={formLabel}>Reference / note<input name="reference" className={input} /></label><ConfirmSubmitButton message="Confirm this invoice has been paid?" className={`${primary} justify-center`}>Confirm settlement</ConfirmSubmitButton></form></section>
            <form action={voidInvoiceAction}><input type="hidden" name="invoiceId" value={id} /><ConfirmSubmitButton message="Void this issued invoice? Its number and record will be retained." className="min-h-11 w-full rounded-xl border border-red-200 bg-white text-sm font-extrabold text-red-700">Void invoice</ConfirmSubmitButton></form>
          </>}
      </>}
      {(invoice.status === "paid" || invoice.status === "void") && <form action={duplicateInvoiceAction}><input type="hidden" name="invoiceId" value={id} /><button className="min-h-11 w-full rounded-xl border border-[#C9D5E2] bg-white text-sm font-extrabold text-[#1446A5]">Duplicate as new draft</button></form>}
      {invoice.status === "paid" && <InvoiceEmailSendPanel invoiceId={id} recipient={invoice.customer_email || ""} logicalSendId={newEmailSendId!} isCopy hasUncertainSend={hasAmbiguousSend} />}
    </aside></div>
  </>;
}

function InvoiceEmailSendPanel({ invoiceId, recipient, logicalSendId, isCopy, hasUncertainSend }: { invoiceId: string; recipient: string; logicalSendId: string; isCopy: boolean; hasUncertainSend: boolean }) {
  return <section id="send" className="scroll-mt-20 rounded-2xl border border-[#E4EAF0] bg-white p-5">
    <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#071127]"><Mail size={18} /> {isCopy ? "Send copy" : "Send invoice"}</h2>
    {hasUncertainSend && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">A previous delivery is uncertain. Check Resend before deliberately creating another send.</p>}
    <form action={sendInvoiceAction} className="mt-4 grid gap-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="intent" value="new" />
      <input type="hidden" name="logicalSendId" value={logicalSendId} />
      <label className={formLabel}>Recipient<input required type="email" name="recipient" defaultValue={recipient} className={input} /></label>
      {isCopy
        ? <ConfirmSubmitButton message="Send a deliberate new copy with its own logical send ID and delivery record?" className={`${primary} justify-center`}>Send copy</ConfirmSubmitButton>
        : <button className={`${primary} justify-center`}>Send PDF invoice</button>}
    </form>
  </section>;
}

function EmailSendStatus({ status }: { status: "pending" | "sent" | "failed" | "ambiguous" }) {
  const label = status === "pending" ? "Processing" : status === "sent" ? "Sent" : status === "failed" ? "Failed" : "Uncertain";
  const tone = status === "sent" ? "bg-green-50 text-green-800" : status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${tone}`}>{label}</span>;
}

const primary = "inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-extrabold text-white";
const secondary = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C9D5E2] bg-white px-4 text-sm font-extrabold text-[#1446A5]";
const input = "mt-2 min-h-11 w-full rounded-xl border border-[#D7E0E9] bg-white px-3 text-sm font-semibold text-[#071127]";
const formLabel = "text-xs font-extrabold tracking-wide text-[#667586] uppercase";
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-semibold text-[#071127]">{value}</dd></div>; }
function Total({ label, value }: { label: string; value: string | number | bigint }) { return <div className="flex justify-between py-2 text-sm"><dt>{label}</dt><dd className="font-extrabold">{formatPence(value)}</dd></div>; }
function TextBlock({ title, text }: { title: string; text: string }) { return <section className="rounded-2xl bg-[#F4F7FA] p-5"><h2 className="text-sm font-extrabold tracking-wide text-[#586575] uppercase">{title}</h2><p className="mt-3 whitespace-pre-wrap leading-6 text-[#263446]">{text}</p></section>; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(`${value}T12:00:00Z`)) : "—"; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
function trimQuantity(value: string) { return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"); }
function auditLabel(value: string) { return value.replace(/^invoice\./, "").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
