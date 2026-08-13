import "server-only";

import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import { deliverInvoiceEmail } from "./email-delivery";
import { formatPence } from "./money";
import { renderInvoicePdf } from "./pdf";
import type { Invoice } from "./types";

export type InvoiceEmailSendSummary = {
  id: string;
  recipient: string;
  invoice_revision: number | string;
  document_status: "issued" | "paid";
  status: "pending" | "sent" | "failed" | "ambiguous";
  last_error_code: string | null;
  requested_at: string;
  sent_at: string | null;
};

export async function requireInvoiceAdmin() {
  const auth = await getAdminUser();
  if (!auth) throw new Error("Unauthorised");
  return { auth, client: auth.client };
}

export async function getInvoiceForAdmin(id: string): Promise<Invoice | null> {
  const { client } = await requireInvoiceAdmin();
  const { data, error } = await client.from("invoices").select("*,invoice_items(id,description,quantity,unit_price_pence,line_total_pence,position)").eq("id", id).order("position", { referencedTable: "invoice_items", ascending: true }).maybeSingle();
  if (error) throw new Error("Invoice could not be loaded.");
  return data as unknown as Invoice | null;
}

export async function getInvoiceEmailSendsForAdmin(invoiceId: string): Promise<InvoiceEmailSendSummary[]> {
  const { client } = await requireInvoiceAdmin();
  const { data, error } = await client
    .from("invoice_email_sends")
    .select("id,recipient,invoice_revision,document_status,status,last_error_code,requested_at,sent_at")
    .eq("invoice_id", invoiceId)
    .order("requested_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Invoice email history could not be loaded.");
  return (data || []) as InvoiceEmailSendSummary[];
}

export async function saveInvoiceDraft(payload: Record<string, unknown>, invoiceId?: string, confirmDuplicateSource = false) {
  const { client } = await requireInvoiceAdmin();
  const { data, error } = await client.rpc("save_invoice_draft", { p_invoice_id: invoiceId || null, p_payload: payload, p_confirm_duplicate_source: confirmDuplicateSource });
  if (error || !data) throw new Error(error?.message || "Invoice could not be saved.");
  return String(data);
}

export async function issueInvoice(id: string) { const { client } = await requireInvoiceAdmin(); const { error } = await client.rpc("issue_invoice", { p_invoice_id: id }); if (error) throw new Error(error.message); }
export async function markInvoicePaid(input: { invoiceId: string; paidAt: string; method: string; reference: string }) { const { client } = await requireInvoiceAdmin(); const { error } = await client.rpc("mark_invoice_paid", { p_invoice_id: input.invoiceId, p_paid_at: input.paidAt, p_method: input.method, p_reference: input.reference }); if (error) throw new Error(error.message); }
export async function voidInvoice(id: string) { const { client } = await requireInvoiceAdmin(); const { error } = await client.rpc("void_invoice", { p_invoice_id: id }); if (error) throw new Error(error.message); }

export async function deleteDraftInvoice(id: string) {
  const { client } = await requireInvoiceAdmin();
  const { data, error } = await client.rpc("delete_invoice_draft", { p_invoice_id: id });
  if (error || !data) throw new Error(error?.message || "DRAFT_INVOICE_NOT_FOUND");
}

export async function duplicateInvoice(id: string) {
  const { client } = await requireInvoiceAdmin();
  const { data, error } = await client.rpc("duplicate_invoice_to_draft", { p_invoice_id: id });
  if (error || !data) throw new Error(error?.message || "Invoice could not be duplicated.");
  return String(data);
}

export async function sendInvoiceEmail(id: string, recipient: string, logicalSendId: string) {
  const { client } = await requireInvoiceAdmin();
  const service = createAdminClient();
  if (!service) throw new Error("Invoice email persistence is not configured.");
  const invoice = await getInvoiceForAdmin(id);
  if (!invoice || (invoice.status !== "issued" && invoice.status !== "paid")) throw new Error("Only issued or paid invoices can be emailed.");
  const reference = invoice.invoice_number || "Invoice";
  return deliverInvoiceEmail({
    logicalSendId,
    invoiceId: id,
    invoiceRevision: invoice.revision,
    invoiceStatus: invoice.status,
    recipient,
    subject: `Invoice ${reference} from SOB Autofix`,
    text: [`Hello ${invoice.customer_name},`, "", `Please find invoice ${reference} from SOB Autofix attached.`, `Amount: ${formatPence(invoice.total_pence)}`, invoice.due_date ? `Due date: ${formatLongDate(invoice.due_date)}` : "", "", "If you have any questions, reply to this email.", "", "SOB Autofix Limited"].filter(Boolean).join("\n"),
    attachment: { filename: `SOB-Invoice-${reference}.pdf`, content: await renderInvoicePdf(invoice) },
  }, {
    claim: async (claim) => {
      const { data, error } = await client.rpc("claim_invoice_email_send", {
        p_invoice_id: claim.invoiceId,
        p_recipient: claim.recipient,
        p_logical_send_id: claim.logicalSendId,
        p_invoice_revision: claim.invoiceRevision,
        p_payload_sha256: claim.payloadSha256,
      });
      if (error) throw new Error(error.message);
      const row = firstRow(data) as { attempt_id?: number | string; provider_idempotency_key?: string; claim_token?: string; disposition?: string; should_send?: boolean } | null;
      if (!row) throw new Error("The invoice email could not be claimed.");
      if (row.should_send && row.attempt_id != null && row.claim_token && row.provider_idempotency_key) return { disposition: "dispatch", attemptId: String(row.attempt_id), claimToken: row.claim_token, providerIdempotencyKey: row.provider_idempotency_key };
      if (row.disposition === "already_sent") return { disposition: "already_sent", providerId: null };
      if (row.disposition === "in_progress") return { disposition: "in_progress" };
      return { disposition: "reconciliation_required" };
    },
    finalizeSent: async ({ attemptId, claimToken, providerId }) => {
      const { data, error } = await service.rpc("finalize_invoice_email_send", { p_attempt_id: attemptId, p_claim_token: claimToken, p_provider_id: providerId });
      if (error || data == null) throw new Error(error?.message || "The sent invoice email could not be finalized.");
    },
    recordAttemptOutcome: async ({ attemptId, claimToken, outcome, errorCode, providerId }) => {
      const { data, error } = await service.rpc("fail_invoice_email_send", { p_attempt_id: attemptId, p_claim_token: claimToken, p_error_code: errorCode, p_ambiguous: outcome === "ambiguous", p_provider_id: providerId || null });
      if (error || data == null) throw new Error(error?.message || "The invoice email outcome could not be recorded.");
    },
  });
}

function formatLongDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(`${value}T12:00:00Z`)); }
function firstRow(value: unknown) { return Array.isArray(value) ? value[0] ?? null : value; }
