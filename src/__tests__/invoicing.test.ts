import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, calculateLineTotalPence, formatPence, poundsToPence } from "@/lib/invoices/money";
import { invoiceDraftSchema, paymentSchema } from "@/lib/invoices/schema";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import type { Invoice } from "@/lib/invoices/types";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");
const migration = read("supabase", "migrations", "202608110008_invoicing.sql");

describe("garage invoicing", () => {
  it("parses GBP to integer pence without floating-point arithmetic", () => {
    expect(poundsToPence("1,234.56")).toBe(123456n);
    expect(formatPence(123456n)).toBe("£1,234.56");
    expect(() => poundsToPence("1.999")).toThrow();
  });

  it("calculates quantities and totals exactly", () => {
    expect(calculateLineTotalPence("1.250", 799n)).toBe(999n);
    expect(calculateInvoiceTotals([{ quantity: "1", unitPricePence: 8500n }, { quantity: "2", unitPricePence: 4500n }], 500n)).toEqual({ subtotalPence: 17500n, discountPence: 500n, taxPence: 0n, totalPence: 17000n });
  });

  it("validates manual and booking draft creation", () => {
    const base = { source_type: "manual", booking_id: "", enquiry_id: "", customer_id: "", vehicle_id: "", customer_name: "John Smith", customer_email: "john@example.com", customer_phone: "", customer_address: "", vehicle_registration: "AB12CDE", vehicle_make: "BMW", vehicle_model: "320d", service_name: "Diagnostics", appointment_start: "", issue_date: "2026-08-11", due_date: "2026-08-18", discount_pence: "0", tax_pence: "0", notes: "", payment_terms: "", items: [{ description: "Diagnostics", quantity: "1", unit_price_pence: "8500" }] };
    expect(invoiceDraftSchema.safeParse(base).success).toBe(true);
    expect(invoiceDraftSchema.safeParse({ ...base, source_type: "booking" }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...base, source_type: "booking", booking_id: "61b6fbaf-21e8-4eb8-92df-0522f11a9474" }).success).toBe(true);
  });

  it("rejects a direct or invalid paid transition payload", () => {
    expect(paymentSchema.safeParse({ invoiceId: "61b6fbaf-21e8-4eb8-92df-0522f11a9474", paidAt: "2026-08-11T12:00:00.000Z", method: "cheque", reference: "" }).success).toBe(false);
    expect(migration).toContain("old.status = 'draft'::public.invoice_status and new.status = 'issued'::public.invoice_status");
    expect(migration).toContain("old.status = 'issued'::public.invoice_status and new.status in ('paid'::public.invoice_status, 'void'::public.invoice_status)");
    expect(migration).toContain("INVALID_INVOICE_STATUS_TRANSITION");
  });

  it("allocates sequential numbers safely under concurrency", () => {
    expect(migration).toMatch(/on conflict \(invoice_year\) do update\s+set last_value/);
    expect(migration).toContain("lpad(allocated_sequence::text, 6, '0')");
    expect(migration).not.toMatch(/max\s*\(\s*invoice_number/i);
  });

  it("keeps drafts editable and issued financial records immutable", () => {
    expect(migration).toContain("save_invoice_draft");
    expect(migration).toContain("INVOICE_ITEMS_ARE_IMMUTABLE");
    expect(migration).toContain("ISSUED_INVOICE_IS_IMMUTABLE");
    expect(migration).toContain("ONLY_DRAFT_INVOICES_CAN_BE_DELETED");
  });

  it("protects all invoice data with admin RLS", () => {
    for (const table of ["invoice_number_sequences", "invoices", "invoice_items", "invoice_email_attempts"]) expect(migration).toContain(`alter table public.${table} enable row level security;`);
    expect(migration).toContain("using (public.is_admin())");
    expect(migration).toContain("revoke all on table public.invoices from public, anon");
    expect(migration).not.toMatch(/to anon[^;]+invoices/i);
  });

  it("uses persisted bookings and warns before duplicates", () => {
    const page = read("src", "app", "admin", "(protected)", "invoices", "new", "page.tsx");
    expect(page).toContain('from("bookings")');
    expect(page).toContain("An invoice already exists for this booking");
    expect(page).not.toContain("fetch(\"https://");
  });

  it("supports protected invoice search fields", () => {
    const page = read("src", "app", "admin", "(protected)", "invoices", "page.tsx");
    const dashboardMigration = read("supabase", "migrations", "202608110009_invoice_dashboard_query.sql");
    for (const field of ["invoice_number", "customer_name", "customer_email", "customer_phone", "vehicle_registration"]) expect(dashboardMigration).toContain(field);
    expect(page).toContain("loadInvoiceDashboard");
    expect(page).not.toContain(".limit(500)");
    expect(page).not.toContain("filtered.slice");
  });

  it("authenticates the PDF route and disables caching", () => {
    const route = read("src", "app", "api", "admin", "invoices", "[id]", "pdf", "route.ts");
    expect(route).toContain("getAdminUser"); expect(route).toContain("Unauthorised"); expect(route).toContain("private, no-store"); expect(route).toContain('"Content-Type": "application/pdf"');
  });

  it("routes invoice delivery through the claimed persistent send workflow", () => {
    const repository = read("src", "lib", "invoices", "repository.ts");
    expect(repository).toContain('rpc("claim_invoice_email_send"');
    expect(repository).toContain('rpc("finalize_invoice_email_send"');
    expect(repository).toContain("renderInvoicePdf(invoice)");
    expect(repository).not.toContain('.from("invoice_email_attempts").insert');
  });

  it("renders and parses a real multi-page invoice", async () => {
    const invoice = representativeInvoice("issued", 48);
    const buffer = await renderInvoicePdf(invoice);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(2_000);
    const parsed = await parsePdf(buffer);
    expect(parsed.pages).toBeGreaterThan(1);
    expect(parsed.pageTexts.every((page) => page.includes("UNPAID"))).toBe(true);
    expect(parsed.pageImageCounts.every((count) => count > 0)).toBe(true);
    expect(parsed.text).toContain("SOB-2026-000001");
    const text = parsed.text;
    expect(text).toContain("UNPAID");
    expect(text).toContain("A Customer With A Deliberately Long Trading Name Limited");
    expect(text).toContain("Electrical fault tracing");
    expect(text).toContain("TOTAL GBP");
  }, 20_000);

  it.each([
    ["draft", "DRAFT"],
    ["paid", "PAID / SETTLED"],
    ["void", "VOID"],
  ] as const)("renders the %s status from invoice data", async (status, expected) => {
    const { text } = await parsePdf(await renderInvoicePdf(representativeInvoice(status)));
    expect(text).toContain(expected);
  }, 20_000);

  it("renders the immutable issuer snapshot instead of deploy-time business settings", async () => {
    const invoice = { ...representativeInvoice("issued"), issuer_legal_name: "Historical Workshop Limited", issuer_address: "1 Archived Address\nDoncaster\nDN1 1AA", issuer_email: "historic@example.test", issuer_company_number: "00000001" };
    const { text } = await parsePdf(await renderInvoicePdf(invoice));
    expect(text).toContain("Historical Workshop Limited");
    expect(text).toContain("1 Archived Address");
    expect(text).toContain("historic@example.test");
    expect(text).toContain("Company no. 00000001");
  }, 20_000);

  it("embeds the approved official logo without a runtime network request", async () => {
    const logo = readFileSync(join(root, "assets", "sobautofix_logo-white.png"));
    expect(logo.subarray(1, 4).toString()).toBe("PNG");
    expect(logo.readUInt32BE(16)).toBe(1536);
    expect(logo.readUInt32BE(20)).toBe(1024);

    const parsed = await parsePdf(await renderInvoicePdf(representativeInvoice("issued", 1)));
    expect(parsed.pageImageCounts).toHaveLength(1);
    expect(parsed.pageImageCounts[0]).toBeGreaterThan(0);
  }, 20_000);

  it("renders safely when optional vehicle, notes, due-date and payment values are absent", async () => {
    const invoice = {
      ...representativeInvoice("issued", 1),
      vehicle_registration: null,
      vehicle_make: null,
      vehicle_model: null,
      service_name: null,
      due_date: null,
      payment_terms: null,
      notes: null,
      payment_method: null,
      payment_reference: null,
    };
    const { pages, text } = await parsePdf(await renderInvoicePdf(invoice));
    expect(pages).toBe(1);
    expect(text).toContain("No vehicle or service details recorded.");
    expect(text).not.toContain("NOTES");
    expect(text).not.toContain("VAT");
  }, 20_000);

  it("defines visible PDF labels for draft, paid and void records", () => {
    const pdf = read("src", "lib", "invoices", "pdf.tsx");
    expect(pdf).toContain('invoice.status === "draft" ? "DRAFT"');
    expect(pdf).toContain("invoiceStatusLabel(invoice.status).toUpperCase()");
    expect(pdf).toContain('invoice.status === "void" ? "VOID"');
  });

  it("can emit representative PDFs for rendered visual QA", async () => {
    const output = process.env.INVOICE_PDF_QA_DIR;
    if (!output) return;
    mkdirSync(output, { recursive: true });
    const fixtures: Array<[string, Invoice]> = [
      ["draft-invoice.pdf", representativeInvoice("draft")],
      ["issued-unpaid-invoice.pdf", representativeInvoice("issued")],
      ["paid-settled-invoice.pdf", representativeInvoice("paid")],
      ["void-invoice.pdf", representativeInvoice("void")],
      ["one-line-invoice.pdf", representativeInvoice("issued", 1)],
      ["multi-line-invoice.pdf", representativeInvoice("issued", 48)],
      ["long-customer-details-invoice.pdf", { ...representativeInvoice("issued", 3), customer_name: "A Customer With An Exceptionally Long Automotive Engineering And Fleet Services Trading Name Limited", customer_email: "accounts-payable-and-workshop-authorisations@very-long-customer-domain.example", customer_address: "Unit 128, Long Industrial Estate Approach, North Business Park\nNorton\nDoncaster\nSouth Yorkshire\nDN6 9HF", notes: "Controlled visual QA invoice with deliberately extended notes to verify that customer-facing workshop observations, authorisation context and follow-up guidance wrap naturally without colliding with totals, payment terms or the branded footer." }],
      ["long-line-items-invoice.pdf", { ...representativeInvoice("issued", 10), invoice_items: representativeInvoice("issued", 10).invoice_items.map((item, index) => ({ ...item, description: `${item.description} - detailed inspection, evidence-led diagnosis, component testing and documented workshop findings for line ${index + 1}` })) }],
    ];
    for (const [name, invoice] of fixtures) writeFileSync(join(output, name), await renderInvoicePdf(invoice));
  }, 30_000);
});

function representativeInvoice(status: Invoice["status"], itemCount = 16): Invoice {
  const items = Array.from({ length: itemCount }, (_, position) => ({ id: `item-${position}`, description: position === 0 ? "Electrical fault tracing with a deliberately long diagnostic description that wraps cleanly across the invoice table" : `Workshop service line ${position + 1}`, quantity: "1.000", unit_price_pence: 4500, line_total_pence: 4500, position }));
  const subtotal = itemCount * 4500;
  return { id: "61b6fbaf-21e8-4eb8-92df-0522f11a9474", invoice_number: status === "draft" ? null : "SOB-2026-000001", invoice_year: status === "draft" ? null : 2026, invoice_sequence: status === "draft" ? null : 1, revision: 1, replaces_invoice_id: null, status, source_type: "manual", booking_id: null, enquiry_id: null, customer_id: null, vehicle_id: null, currency: "GBP", customer_name: "A Customer With A Deliberately Long Trading Name Limited", customer_email: "customer@example.com", customer_phone: "07000 000000", customer_address: "1 Very Long Workshop Approach, Norton, Doncaster, DN6 9HF", vehicle_registration: "AB12CDE", vehicle_make: "BMW", vehicle_model: "320d", service_name: "Electrical fault finding", appointment_start: null, issuer_legal_name: "SOB Autofix Limited", issuer_trading_name: "SOB Autofix", issuer_tagline: "Professional Diagnostics. Not Guesswork.", issuer_address: "Cumbrae\nStation Road\nNorton\nDoncaster\nDN6 9HF\nUnited Kingdom", issuer_email: "sobautofix@gmail.com", issuer_phone: "07469273483", issuer_company_number: "16182532", issue_date: "2026-08-11", due_date: "2026-08-18", subtotal_pence: subtotal, discount_pence: 0, tax_pence: 0, total_pence: subtotal, notes: "Thank you for your business.", payment_terms: "Payment due within 7 days.", issued_at: status === "draft" ? null : "2026-08-11T12:00:00Z", paid_at: status === "paid" ? "2026-08-11T12:00:00Z" : null, payment_method: status === "paid" ? "card" : null, payment_reference: status === "paid" ? "ABC123" : null, voided_at: status === "void" ? "2026-08-11T12:00:00Z" : null, created_by: null, updated_by: null, created_at: "2026-08-11T12:00:00Z", updated_at: "2026-08-11T12:00:00Z", invoice_items: items };
}

async function parsePdf(buffer: Buffer) {
  const standardFontDataUrl = `${join(root, "node_modules", "pdfjs-dist", "standard_fonts").replaceAll("\\", "/")}/`;
  const loadingTask = getDocument({ data: new Uint8Array(buffer), standardFontDataUrl });
  const document = await loadingTask.promise;
  const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
    const page = await document.getPage(index + 1);
    const [content, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
    const imageOperators = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject]);
    return {
      text: content.items.map((item) => "str" in item ? item.str : "").join(" "),
      imageCount: operators.fnArray.filter((operator) => imageOperators.has(operator)).length,
    };
  }));
  const pageTexts = pages.map((page) => page.text.replace(/-\s+/g, "").replace(/\s+/g, " "));
  const result = { pages: document.numPages, pageTexts, pageImageCounts: pages.map((page) => page.imageCount), text: pageTexts.join(" ") };
  await loadingTask.destroy();
  return result;
}
