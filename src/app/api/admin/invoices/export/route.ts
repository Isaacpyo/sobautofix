import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import { InvoiceExportValidationError, invoiceExportCsv, loadInvoiceExportRows, normalizeInvoiceExportFilters } from "@/lib/invoices/export";
import { renderInvoiceExportPdf } from "@/lib/invoices/export-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const auth = await getAdminUser();
  if (!auth) return Response.json({ error: "Unauthorised" }, { status: 401, headers: privateHeaders });
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "Invoice export is unavailable" }, { status: 503, headers: privateHeaders });

  try {
    const filters = normalizeInvoiceExportFilters(new URL(request.url).searchParams);
    const rows = await loadInvoiceExportRows(admin, filters);
    const extension = filters.format;
    const filename = `SOB-Invoices-${filters.fileLabel}.${extension}`;
    const body = filters.format === "csv" ? new TextEncoder().encode(invoiceExportCsv(rows)) : new Uint8Array(await renderInvoiceExportPdf(rows, filters));
    const contentType = filters.format === "csv" ? "text/csv; charset=utf-8" : "application/pdf";
    await admin.from("admin_audit_log").insert({ actor_id: auth.user.id, action: "invoice.exported", entity_type: "invoice_export", entity_id: filters.fileLabel, detail: { format: filters.format, period: filters.period, status: filters.status, source: filters.source, count: rows.length } });
    return new Response(body, { headers: { ...privateHeaders, "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    if (error instanceof InvoiceExportValidationError) return Response.json({ error: error.message }, { status: 400, headers: privateHeaders });
    console.error("[invoice-export] Export failed", error);
    return Response.json({ error: "Invoice export could not be created" }, { status: 500, headers: privateHeaders });
  }
}
