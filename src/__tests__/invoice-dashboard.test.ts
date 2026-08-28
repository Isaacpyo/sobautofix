import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  invoiceDashboardPageSize,
  loadInvoiceDashboard,
  normalizeInvoiceDashboardFilters,
} from "@/lib/invoices/dashboard";

describe("invoice dashboard query", () => {
  it("normalizes untrusted URL filters before they reach PostgreSQL", () => {
    expect(normalizeInvoiceDashboardFilters({
      q: `  ${"x".repeat(250)}  `,
      status: "administrator",
      date: "2026-02-31",
      page: "1e3",
    })).toEqual({ query: "x".repeat(200), status: "", date: "", requestedPage: 1 });

    expect(normalizeInvoiceDashboardFilters({
      q: " AB12 CDE ",
      status: "issued",
      date: "2026-08-11",
      page: "42",
    })).toEqual({ query: "AB12 CDE", status: "issued", date: "2026-08-11", requestedPage: 42 });
  });

  it("uses the guarded database RPC and preserves integer totals as strings", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        invoices: [{ id: "invoice-1", total_pence: 9007199254740991 }],
        matching_count: "1005",
        page: 41,
        pages: 41,
        draft_count: "1005",
        outstanding_count: "2",
        paid_count: "7",
        outstanding_total_pence: "9007199254740992",
        current_week_paid_total_pence: "123456",
      },
      error: null,
    });
    const filters = normalizeInvoiceDashboardFilters({ q: "smith", status: "issued", page: "999" });
    const result = await loadInvoiceDashboard({ rpc } as unknown as SupabaseClient, filters);

    expect(rpc).toHaveBeenCalledWith("get_invoice_dashboard", {
      p_query: "smith",
      p_status: "issued",
      p_date: null,
      p_page: 999,
      p_page_size: invoiceDashboardPageSize,
    });
    expect(result).toMatchObject({
      matchingCount: "1005",
      page: 41,
      pages: 41,
      draftCount: "1005",
      outstandingTotalPence: "9007199254740992",
      currentWeekPaidTotalPence: "123456",
      error: null,
    });
  });

  it("defines an admin-only, uncapped server-side query", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "202608110009_invoice_dashboard_query.sql"),
      "utf8",
    );
    expect(migration).toContain("actor_id uuid := public.require_invoice_actor()");
    expect(migration).toContain("matching_count::text");
    expect(migration).toContain("outstanding_total::text");
    expect(migration).toContain("offset (effective_page - 1) * p_page_size");
    expect(migration).not.toMatch(/limit\s+500/i);
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("to authenticated");
  });

  it("totals payments from the current London week", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "202608280001_invoice_weekly_paid_total.sql"),
      "utf8",
    );
    expect(migration).toContain("current_week_paid_total_pence");
    expect(migration).toContain("timezone('Europe/London', statement_timestamp())");
    expect(migration).toContain("invoice.paid_at >= week_start");
    expect(migration).toContain("invoice.paid_at < week_end");
  });

  it("uses the shared admin pagination and preserves invoice filters", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/admin/(protected)/invoices/page.tsx"),
      "utf8",
    );
    expect(source).toContain('<AdminPagination path="/admin/invoices"');
    expect(source).toContain("totalItems={matchingCount}");
    expect(source).toContain("totalPages={pages}");
    expect(source).toContain("additionalParams={{ date }}");
  });

  it("matches the appointment table's customer and vehicle column spacing", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/admin/(protected)/invoices/page.tsx"),
      "utf8",
    );
    expect(source).toContain('min-w-[1100px] table-fixed');
    expect(source).toContain('<col className="w-[10%]" /><col className="w-[17%]" /><col className="w-[18%]" />');
  });
});
