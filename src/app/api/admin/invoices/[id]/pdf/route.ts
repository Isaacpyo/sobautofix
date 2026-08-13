import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import { getInvoiceForAdmin } from "@/lib/invoices/repository";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAdminUser();
  if (!auth) return Response.json({ error: "Unauthorised" }, { status: 401, headers: privateHeaders });
  const { id } = await params;
  const invoice = await getInvoiceForAdmin(id);
  if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404, headers: privateHeaders });
  const pdf = await renderInvoicePdf(invoice);
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const fileReference = invoice.invoice_number || "Draft";
  const admin = createAdminClient();
  if (admin) await admin.from("admin_audit_log").insert({ actor_id: auth.user.id, action: "invoice.pdf_downloaded", entity_type: "invoice", entity_id: id, detail: { preview } });
  return new Response(new Uint8Array(pdf), { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="SOB-Invoice-${fileReference}.pdf"`, "X-Content-Type-Options": "nosniff" } });
}

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" };
