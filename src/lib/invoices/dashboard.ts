import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceSourceType, InvoiceStatus } from "./types";

export const invoiceDashboardPageSize = 25;

export type InvoiceDashboardSearchParams = {
  q?: string;
  status?: string;
  date?: string;
  page?: string;
};

export type InvoiceDashboardFilters = {
  query: string;
  status: InvoiceStatus | "";
  date: string;
  requestedPage: number;
};

export type InvoiceDashboardRow = {
  id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  source_type: InvoiceSourceType;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_pence: string | number;
  created_at: string;
};

export type InvoiceDashboardData = {
  invoices: InvoiceDashboardRow[];
  matchingCount: string;
  page: number;
  pages: number;
  draftCount: string;
  outstandingCount: string;
  paidCount: string;
  outstandingTotalPence: string;
  error: unknown | null;
};

export function normalizeInvoiceDashboardFilters(params: InvoiceDashboardSearchParams): InvoiceDashboardFilters {
  const query = (params.q || "").trim().slice(0, 200);
  const status = isInvoiceStatus(params.status) ? params.status : "";
  const date = isIsoDate(params.date) ? params.date : "";
  const requestedPage = /^\d+$/.test(params.page || "")
    ? Math.min(2_147_483_647, Math.max(1, Number(params.page)))
    : 1;
  return { query, status, date, requestedPage };
}

export async function loadInvoiceDashboard(
  client: SupabaseClient,
  filters: InvoiceDashboardFilters,
): Promise<InvoiceDashboardData> {
  const { data, error } = await client.rpc("get_invoice_dashboard", {
    p_query: filters.query || null,
    p_status: filters.status || null,
    p_date: filters.date || null,
    p_page: filters.requestedPage,
    p_page_size: invoiceDashboardPageSize,
  });
  if (error) return { ...emptyInvoiceDashboard, error };

  try {
    return parseInvoiceDashboard(data);
  } catch (parseError) {
    return { ...emptyInvoiceDashboard, error: parseError };
  }
}

export const emptyInvoiceDashboard: InvoiceDashboardData = {
  invoices: [],
  matchingCount: "0",
  page: 1,
  pages: 1,
  draftCount: "0",
  outstandingCount: "0",
  paidCount: "0",
  outstandingTotalPence: "0",
  error: null,
};

function parseInvoiceDashboard(value: unknown): InvoiceDashboardData {
  if (!isRecord(value) || !Array.isArray(value.invoices)) throw new Error("INVALID_INVOICE_DASHBOARD_RESPONSE");
  return {
    invoices: value.invoices as InvoiceDashboardRow[],
    matchingCount: nonNegativeIntegerString(value.matching_count),
    page: positiveInteger(value.page),
    pages: positiveInteger(value.pages),
    draftCount: nonNegativeIntegerString(value.draft_count),
    outstandingCount: nonNegativeIntegerString(value.outstanding_count),
    paidCount: nonNegativeIntegerString(value.paid_count),
    outstandingTotalPence: nonNegativeIntegerString(value.outstanding_total_pence),
    error: null,
  };
}

function isInvoiceStatus(value: string | undefined): value is InvoiceStatus {
  return value === "draft" || value === "issued" || value === "paid" || value === "void";
}

function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error("INVALID_INVOICE_DASHBOARD_RESPONSE");
  return value;
}

function nonNegativeIntegerString(value: unknown) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (!/^\d+$/.test(text)) throw new Error("INVALID_INVOICE_DASHBOARD_RESPONSE");
  return text;
}
