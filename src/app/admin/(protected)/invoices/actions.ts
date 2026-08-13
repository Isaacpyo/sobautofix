"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { invoiceDraftSchema, paymentSchema, sendInvoiceSchema, friendlyInvoiceError } from "@/lib/invoices/schema";
import { deleteDraftInvoice, duplicateInvoice, issueInvoice, markInvoicePaid, saveInvoiceDraft, sendInvoiceEmail, voidInvoice } from "@/lib/invoices/repository";

export type InvoiceFormState = { error: string };
export async function saveInvoiceDraftAction(_previous: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  let id: string;
  try { const invoiceId = z.union([z.literal(""), z.string().uuid()]).parse(String(formData.get("invoiceId") || "")); const payload = invoiceDraftSchema.parse(JSON.parse(String(formData.get("payload") || "{}"))); const confirmDuplicateSource = formData.get("confirmDuplicateSource") === "true"; id = await saveInvoiceDraft(payload, invoiceId || undefined, confirmDuplicateSource); }
  catch (error) { return { error: friendlyInvoiceError(error) }; }
  refresh(id); redirect(`/admin/invoices/${id}?notice=saved`);
}
export async function issueInvoiceAction(formData: FormData) { const id = uuid(formData); await issueInvoice(id); refresh(id); redirect(`/admin/invoices/${id}?notice=issued`); }
export async function voidInvoiceAction(formData: FormData) { const id = uuid(formData); await voidInvoice(id); refresh(id); redirect(`/admin/invoices/${id}?notice=voided`); }
export async function deleteDraftInvoiceAction(formData: FormData) { const id = uuid(formData); await deleteDraftInvoice(id); refresh(id); redirect("/admin/invoices?notice=deleted"); }
export async function duplicateInvoiceAction(formData: FormData) { const id = uuid(formData); const draftId = await duplicateInvoice(id); refresh(draftId); redirect(`/admin/invoices/${draftId}/edit?notice=duplicated`); }
export async function markInvoicePaidAction(formData: FormData) { const date = String(formData.get("paidAt") || ""); const parsed = paymentSchema.parse({ invoiceId: formData.get("invoiceId"), paidAt: date ? new Date(`${date}T12:00:00Z`).toISOString() : "", method: formData.get("method"), reference: formData.get("reference") || "" }); await markInvoicePaid(parsed); refresh(parsed.invoiceId); redirect(`/admin/invoices/${parsed.invoiceId}?notice=paid`); }
export async function sendInvoiceAction(formData: FormData) {
  const parsed = sendInvoiceSchema.parse({ invoiceId: formData.get("invoiceId"), recipient: formData.get("recipient"), intent: formData.get("intent") || "new", logicalSendId: formData.get("logicalSendId") });
  const result = await sendInvoiceEmail(parsed.invoiceId, parsed.recipient, parsed.logicalSendId);
  refresh(parsed.invoiceId);
  if (result.outcome === "sent" || result.outcome === "already_sent") redirect(`/admin/invoices/${parsed.invoiceId}?notice=sent`);
  if (result.outcome === "failed") redirect(`/admin/invoices/${parsed.invoiceId}?notice=email_failed&emailSendId=${parsed.logicalSendId}`);
  if (result.outcome === "in_progress") redirect(`/admin/invoices/${parsed.invoiceId}?notice=email_pending&emailSendId=${parsed.logicalSendId}`);
  redirect(`/admin/invoices/${parsed.invoiceId}?notice=email_reconcile&emailSendId=${parsed.logicalSendId}`);
}
function uuid(formData: FormData) { return z.string().uuid().parse(formData.get("invoiceId")); }
function refresh(id: string) { revalidatePath("/admin"); revalidatePath("/admin/invoices"); revalidatePath(`/admin/invoices/${id}`); }
