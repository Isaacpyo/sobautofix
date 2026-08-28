import { describe, expect, it } from "vitest";
import { invoiceExportCsv, normalizeInvoiceExportFilters, type InvoiceExportRow } from "@/lib/invoices/export";

describe("invoice exports", () => {
  it("normalizes month, year and custom reporting periods", () => {
    expect(normalizeInvoiceExportFilters(new URLSearchParams("period=date&date=2026-08-28"))).toMatchObject({ startDate: "2026-08-28", endDate: "2026-08-28", fileLabel: "2026-08-28" });
    expect(normalizeInvoiceExportFilters(new URLSearchParams("period=month&month=2026-02&format=csv&status=paid&source=booking"))).toMatchObject({
      format: "csv", startDate: "2026-02-01", endDate: "2026-02-28", status: "paid", source: "booking", fileLabel: "2026-02",
    });
    expect(normalizeInvoiceExportFilters(new URLSearchParams("period=year&year=2027"))).toMatchObject({ startDate: "2027-01-01", endDate: "2027-12-31" });
    expect(normalizeInvoiceExportFilters(new URLSearchParams("period=custom&start=2026-03-02&end=2026-04-05"))).toMatchObject({ startDate: "2026-03-02", endDate: "2026-04-05" });
    expect(() => normalizeInvoiceExportFilters(new URLSearchParams("period=custom&start=2026-04-05&end=2026-03-02"))).toThrow(/start date/i);
  });

  it("creates spreadsheet-friendly CSV with exact currency and formula-injection protection", () => {
    const row: InvoiceExportRow = {
      id: "invoice-1", invoice_number: "SOB-2026-000001", status: "paid", source_type: "manual", customer_name: "=SUM(A1:A2)", customer_email: "customer@example.com", customer_phone: "07123456789", vehicle_registration: "AB12 CDE", vehicle_make: "Ford", vehicle_model: "Focus", service_name: "Diagnostics", issue_date: "2026-08-20", due_date: "2026-08-27", subtotal_pence: "12345", discount_pence: "345", total_pence: "12000", paid_at: "2026-08-21T10:00:00Z", payment_method: "card", payment_reference: "PAY-1", created_at: "2026-08-20T10:00:00Z",
    };
    const csv = invoiceExportCsv([row]);

    expect(csv).toContain('"123.45","3.45","120.00"');
    expect(csv).toContain('"\'=SUM(A1:A2)"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
