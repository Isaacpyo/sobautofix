import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  admin: null as Record<string, unknown> | null,
  getAdminUser: vi.fn(),
  renderInvoicePdf: vi.fn(),
}));

const serviceClient = {
  from: vi.fn(() => ({ insert: vi.fn(async () => ({ error: null })) })),
};

vi.mock("@/lib/supabase/server", () => ({
  getAdminUser: harness.getAdminUser,
  createAdminClient: vi.fn(() => serviceClient),
}));
vi.mock("@/lib/invoices/repository", () => ({
  getInvoiceForAdmin: vi.fn(async () => ({
    id: "invoice-id",
    invoice_number: "SOB-2026-000001",
  })),
}));
vi.mock("@/lib/invoices/pdf", () => ({
  renderInvoicePdf: harness.renderInvoicePdf,
}));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/vehicle/configured-provider", () => ({ getConfiguredVehicleProvider: vi.fn() }));

import { POST as inventoryLookup } from "@/app/api/admin/inventory/lookup/route";
import { GET as invoicePdf } from "@/app/api/admin/invoices/[id]/pdf/route";

describe("admin API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.admin = null;
    harness.getAdminUser.mockImplementation(async () => harness.admin);
    harness.renderInvoicePdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("returns 401 with no-store before handling either endpoint", async () => {
    const inventoryResponse = await inventoryLookup(new Request("https://sobautofix.com/api/admin/inventory/lookup", {
      method: "POST",
      body: JSON.stringify({ registration: "AB12CDE" }),
    }) as never);
    expect(inventoryResponse.status).toBe(401);
    expect(inventoryResponse.headers.get("cache-control")).toBe("no-store");

    const pdfResponse = await invoicePdf(new Request("https://sobautofix.com/api/admin/invoices/invoice-id/pdf"), {
      params: Promise.resolve({ id: "invoice-id" }),
    });
    expect(pdfResponse.status).toBe(401);
    expect(pdfResponse.headers.get("cache-control")).toContain("private");
    expect(pdfResponse.headers.get("cache-control")).toContain("no-store");
    expect(harness.renderInvoicePdf).not.toHaveBeenCalled();
  });

  it("serves a private PDF after the strict admin guard succeeds", async () => {
    harness.admin = { user: { id: "admin-id" }, mfaVerified: true };
    const response = await invoicePdf(new Request("https://sobautofix.com/api/admin/invoices/invoice-id/pdf?preview=1"), {
      params: Promise.resolve({ id: "invoice-id" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});
