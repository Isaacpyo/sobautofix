import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceStatusLabel, sourceLabel, type InvoiceSourceType, type InvoiceStatus } from "./types";

export type InvoiceExportFormat = "pdf" | "csv";
export type InvoiceExportPeriod = "all" | "date" | "month" | "year" | "custom";

export type InvoiceExportFilters = {
  format: InvoiceExportFormat;
  period: InvoiceExportPeriod;
  startDate: string | null;
  endDate: string | null;
  status: InvoiceStatus | null;
  source: InvoiceSourceType | null;
  label: string;
  fileLabel: string;
};

export type InvoiceExportRow = {
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
  service_name: string | null;
  issue_date: string | null;
  due_date: string | null;
  subtotal_pence: string | number;
  discount_pence: string | number;
  total_pence: string | number;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
};

export class InvoiceExportValidationError extends Error {}

export function normalizeInvoiceExportFilters(params: URLSearchParams): InvoiceExportFilters {
  const rawFormat = params.get("format");
  if (rawFormat && rawFormat !== "pdf" && rawFormat !== "csv") throw new InvoiceExportValidationError("Choose PDF or CSV format.");
  const format = rawFormat === "csv" ? "csv" : "pdf";
  const rawPeriod = params.get("period");
  if (rawPeriod && rawPeriod !== "all" && rawPeriod !== "date" && rawPeriod !== "month" && rawPeriod !== "year" && rawPeriod !== "custom") throw new InvoiceExportValidationError("Choose a valid reporting period.");
  const period: InvoiceExportPeriod = rawPeriod === "date" || rawPeriod === "month" || rawPeriod === "year" || rawPeriod === "custom" ? rawPeriod : "all";
  const rawStatus = params.get("status");
  const rawSource = params.get("source");
  if (rawStatus && !validStatus(rawStatus)) throw new InvoiceExportValidationError("Choose a valid invoice status.");
  if (rawSource && !validSource(rawSource)) throw new InvoiceExportValidationError("Choose a valid invoice source.");
  const status = validStatus(rawStatus);
  const source = validSource(rawSource);
  let startDate: string | null = null;
  let endDate: string | null = null;
  let label = "All dates";
  let fileLabel = "all-dates";

  if (period === "date") {
    const date = params.get("date") || "";
    if (!isIsoDate(date)) throw new InvoiceExportValidationError("Choose a valid date.");
    startDate = date;
    endDate = date;
    label = displayDate(date);
    fileLabel = date;
  } else if (period === "month") {
    const month = params.get("month") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new InvoiceExportValidationError("Choose a valid month.");
    const year = Number(month.slice(0, 4));
    const monthNumber = Number(month.slice(5, 7));
    startDate = `${month}-01`;
    endDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${startDate}T12:00:00Z`));
    fileLabel = month;
  } else if (period === "year") {
    const year = params.get("year") || "";
    if (!/^\d{4}$/.test(year) || Number(year) < 2020 || Number(year) > 9999) throw new InvoiceExportValidationError("Choose a valid year.");
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
    label = year;
    fileLabel = year;
  } else if (period === "custom") {
    const start = params.get("start") || "";
    const end = params.get("end") || "";
    if (!isIsoDate(start) || !isIsoDate(end)) throw new InvoiceExportValidationError("Choose valid start and end dates.");
    if (start > end) throw new InvoiceExportValidationError("The start date must be on or before the end date.");
    startDate = start;
    endDate = end;
    label = `${displayDate(start)} to ${displayDate(end)}`;
    fileLabel = `${start}-to-${end}`;
  }

  return { format, period, startDate, endDate, status, source, label, fileLabel };
}

export async function loadInvoiceExportRows(client: SupabaseClient, filters: InvoiceExportFilters) {
  const rows: InvoiceExportRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = client.from("invoices").select("id,invoice_number,status,source_type,customer_name,customer_email,customer_phone,vehicle_registration,vehicle_make,vehicle_model,service_name,issue_date,due_date,subtotal_pence,discount_pence,total_pence,paid_at,payment_method,payment_reference,created_at");
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.source) query = query.eq("source_type", filters.source);
    const { data, error } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw new Error("Invoice export data could not be loaded.");
    const batch = (data || []) as InvoiceExportRow[];
    rows.push(...batch.filter((row) => isWithinDateRange(row, filters)));
    if (batch.length < pageSize) break;
  }
  return rows;
}

export function invoiceExportCsv(rows: InvoiceExportRow[]) {
  const headings = ["Invoice number", "Status", "Source", "Issue date", "Due date", "Paid date", "Customer", "Email", "Phone", "Registration", "Vehicle", "Service", "Subtotal GBP", "Discount GBP", "Total GBP", "Payment method", "Payment reference"];
  const body = rows.map((row) => [
    row.invoice_number || "DRAFT",
    invoiceStatusLabel(row.status),
    sourceLabel(row.source_type),
    exportDate(row),
    row.due_date || "",
    row.paid_at?.slice(0, 10) || "",
    safeSpreadsheetText(row.customer_name),
    safeSpreadsheetText(row.customer_email || ""),
    safeSpreadsheetText(row.customer_phone || ""),
    safeSpreadsheetText(row.vehicle_registration || ""),
    safeSpreadsheetText([row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ")),
    safeSpreadsheetText(row.service_name || ""),
    penceToDecimal(row.subtotal_pence),
    penceToDecimal(row.discount_pence),
    penceToDecimal(row.total_pence),
    paymentMethodLabel(row.payment_method),
    safeSpreadsheetText(row.payment_reference || ""),
  ]);
  return `\uFEFF${[headings, ...body].map((cells) => cells.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function exportDate(row: Pick<InvoiceExportRow, "issue_date" | "created_at">) {
  return row.issue_date || row.created_at.slice(0, 10);
}

export function invoiceExportFilterDescription(filters: InvoiceExportFilters) {
  return [filters.label, filters.status ? invoiceStatusLabel(filters.status) : "All statuses", filters.source ? sourceLabel(filters.source) : "All sources"].join(" - ");
}

function isWithinDateRange(row: InvoiceExportRow, filters: InvoiceExportFilters) {
  const date = exportDate(row);
  return (!filters.startDate || date >= filters.startDate) && (!filters.endDate || date <= filters.endDate);
}

function validStatus(value: string | null): InvoiceStatus | null {
  return value === "draft" || value === "issued" || value === "paid" || value === "void" ? value : null;
}

function validSource(value: string | null): InvoiceSourceType | null {
  return value === "booking" || value === "enquiry" || value === "manual" ? value : null;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function penceToDecimal(value: string | number) {
  const pence = BigInt(value);
  const sign = pence < 0n ? "-" : "";
  const absolute = pence < 0n ? -pence : pence;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function safeSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function paymentMethodLabel(value: string | null) {
  if (!value) return "";
  return value === "bank_transfer" ? "Bank transfer" : value.charAt(0).toUpperCase() + value.slice(1);
}
