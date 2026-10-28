import "server-only";

import { qualifiedSubmissionStatuses, stockStatusLabels } from "@/components/admin/exchange/labels";
import { daysInStock, recordedGrossMargin, type CostLine } from "@/lib/exchange/margin";
import type { StaffContext } from "@/lib/exchange/staff";
import type { SaleVehicleStatus } from "@/types/domain";
import { assertCan, must } from "./core";

export type ReportPeriod = { from: string; to: string; label: string; key: string };

const DAY = 86_400_000;

export function reportPeriod(key: string | undefined, now = new Date()): ReportPeriod {
  const today = now.toISOString().slice(0, 10);
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY).toISOString().slice(0, 10);
  switch (key) {
    case "30": return { key: "30", from: daysAgo(30), to: today, label: "Last 30 days" };
    case "year": return { key: "year", from: `${today.slice(0, 4)}-01-01`, to: today, label: `${today.slice(0, 4)} to date` };
    case "all": return { key: "all", from: "2000-01-01", to: today, label: "All time" };
    default: return { key: "90", from: daysAgo(90), to: today, label: "Last 90 days" };
  }
}

export type VehicleInput = {
  id: string; stock_reference: string | null; make: string; model: string; year: number; status: SaleVehicleStatus; price: number;
  created_at: string; listed_at: string | null; sold_at: string | null;
};

export type ReportRow = {
  vehicleId: string; stockReference: string; vehicle: string; status: string; acquiredOn: string | null; listedAt: string | null; soldAt: string | null; daysInStock: number;
  acquisitionPence: number; transportPence: number; preparationRepairPence: number; otherDirectPence: number; totalCostsPence: number;
  salePricePence: number; salePriceBasis: "actual" | "estimated"; grossMarginPence: number; marginBasis: "actual" | "estimated"; hasAcquisitionCost: boolean;
};

/** One row per vehicle, using the definitions in REPORT_DEFINITIONS. Pure for testing. */
export function buildReportRows(input: { vehicles: VehicleInput[]; costs: Array<CostLine & { saleVehicleId: string }>; acquiredOn: Map<string, string | null>; completedSales: Map<string, number> }, now = new Date()): ReportRow[] {
  return input.vehicles.map((vehicle) => {
    const costs = input.costs.filter((cost) => cost.saleVehicleId === vehicle.id);
    const margin = recordedGrossMargin({ costs, advertisedPricePounds: vehicle.price, completedSalePence: input.completedSales.get(vehicle.id) ?? null });
    const acquiredOn = input.acquiredOn.get(vehicle.id) ?? null;
    return {
      vehicleId: vehicle.id,
      stockReference: vehicle.stock_reference || "",
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      status: stockStatusLabels[vehicle.status] || vehicle.status,
      acquiredOn,
      listedAt: vehicle.listed_at,
      soldAt: vehicle.status === "sold" ? vehicle.sold_at : null,
      daysInStock: daysInStock({ acquiredOn, listedAt: vehicle.listed_at, createdAt: vehicle.created_at, soldAt: vehicle.status === "sold" ? vehicle.sold_at : null }, now),
      acquisitionPence: margin.acquisitionPence,
      transportPence: margin.transportPence,
      preparationRepairPence: margin.preparationRepairPence,
      otherDirectPence: margin.otherDirectPence,
      totalCostsPence: margin.totalPence,
      salePricePence: margin.salePricePence,
      salePriceBasis: margin.salePriceBasis,
      grossMarginPence: margin.grossMarginPence,
      marginBasis: margin.basis,
      hasAcquisitionCost: costs.some((cost) => cost.category === "purchase"),
    };
  });
}

export function summariseRows(rows: ReportRow[], period: ReportPeriod) {
  const soldInPeriod = rows.filter((row) => row.soldAt && row.soldAt.slice(0, 10) >= period.from && row.soldAt.slice(0, 10) <= period.to);
  const sum = (list: ReportRow[], key: keyof ReportRow) => list.reduce((total, row) => total + (row[key] as number), 0);
  return {
    soldCount: soldInPeriod.length,
    salesPence: sum(soldInPeriod, "salePricePence"),
    costsPence: sum(soldInPeriod, "totalCostsPence"),
    grossMarginPence: sum(soldInPeriod, "grossMarginPence"),
    allActual: soldInPeriod.every((row) => row.marginBasis === "actual"),
    averageDaysInStock: soldInPeriod.length ? Math.round(sum(soldInPeriod, "daysInStock") / soldInPeriod.length) : null,
    inStockCount: rows.filter((row) => !row.soldAt && row.status !== stockStatusLabels.archived).length,
    stockCostsPence: sum(rows.filter((row) => !row.soldAt && row.status !== stockStatusLabels.archived), "totalCostsPence"),
  };
}

/** CSV for accountants. Vehicle and money columns only: no customer details, no registration. */
export function reportCsv(rows: ReportRow[]) {
  const header = ["Stock reference", "Vehicle", "Status", "Acquired on", "Listed on", "Sold on", "Days in stock", "Acquisition cost (GBP)", "Transport (GBP)", "Preparation and repair (GBP)", "Other direct costs (GBP)", "Total direct costs (GBP)", "Sale price (GBP)", "Sale price basis", "Recorded gross margin (GBP)", "Margin basis"];
  const money = (pence: number) => (pence / 100).toFixed(2);
  const lines = rows.map((row) => [row.stockReference, row.vehicle, row.status, row.acquiredOn || "", row.listedAt?.slice(0, 10) || "", row.soldAt?.slice(0, 10) || "", String(row.daysInStock), money(row.acquisitionPence), money(row.transportPence), money(row.preparationRepairPence), money(row.otherDirectPence), money(row.totalCostsPence), money(row.salePricePence), row.salePriceBasis === "actual" ? "Actual" : "Estimated", money(row.grossMarginPence), row.marginBasis === "actual" ? "Actual" : "Estimated"]);
  return [header, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value: string) {
  // Neutralise spreadsheet formulas, then quote.
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export type Funnel = { viewingRequests: number; salesEnquiries: number; sellerSubmissions: number; qualifiedSellerEnquiries: number; offersAccepted: number; purchased: number; sold: number };

export async function loadReport(staff: StaffContext, period: ReportPeriod, now = new Date()) {
  assertCan(staff, "finance.view");
  const client = staff.client;
  const fromIso = `${period.from}T00:00:00Z`;
  const toIso = `${period.to}T23:59:59.999Z`;
  const [vehicles, costs, internal, sales, viewings, salesEnquiries, submissions, offers] = await Promise.all([
    client.from("sale_vehicles").select("id,stock_reference,make,model,year,status,price,created_at,listed_at,sold_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(1000),
    client.from("vehicle_costs").select("sale_vehicle_id,category,amount_pence,basis"),
    client.from("vehicle_internal_records").select("sale_vehicle_id,acquired_on"),
    client.from("vehicle_sales").select("sale_vehicle_id,agreed_price_pence,completed_at").eq("status", "completed"),
    client.from("diary_appointments").select("id", { count: "exact", head: true }).eq("kind", "viewing").gte("created_at", fromIso).lte("created_at", toIso),
    client.from("enquiries").select("id", { count: "exact", head: true }).eq("type", "vehicle_sales").is("deleted_at", null).gte("created_at", fromIso).lte("created_at", toIso),
    client.from("seller_submissions").select("id,status,created_at,updated_at").gte("created_at", fromIso).lte("created_at", toIso),
    client.from("seller_offers").select("id", { count: "exact", head: true }).eq("status", "accepted").gte("decided_at", fromIso).lte("decided_at", toIso),
  ]);
  must(vehicles, "The report could not be loaded.");
  const rows = buildReportRows({
    vehicles: (vehicles.data || []) as VehicleInput[],
    costs: ((costs.data || []) as Array<{ sale_vehicle_id: string; category: CostLine["category"]; amount_pence: number; basis: CostLine["basis"] }>).map((cost) => ({ saleVehicleId: cost.sale_vehicle_id, category: cost.category, amountPence: cost.amount_pence, basis: cost.basis })),
    acquiredOn: new Map(((internal.data || []) as Array<{ sale_vehicle_id: string; acquired_on: string | null }>).map((row) => [row.sale_vehicle_id, row.acquired_on])),
    completedSales: new Map(((sales.data || []) as Array<{ sale_vehicle_id: string; agreed_price_pence: number }>).map((row) => [row.sale_vehicle_id, row.agreed_price_pence])),
  }, now);
  const submissionRows = (submissions.data || []) as Array<{ status: string }>;
  const summary = summariseRows(rows, period);
  const funnel: Funnel = {
    viewingRequests: viewings.count || 0,
    salesEnquiries: salesEnquiries.count || 0,
    sellerSubmissions: submissionRows.length,
    qualifiedSellerEnquiries: submissionRows.filter((row) => (qualifiedSubmissionStatuses as string[]).includes(row.status)).length,
    offersAccepted: offers.count || 0,
    purchased: submissionRows.filter((row) => row.status === "purchased").length,
    sold: summary.soldCount,
  };
  // Table: everything still held plus anything sold in the period.
  const tableRows = rows.filter((row) => !row.soldAt ? row.status !== stockStatusLabels.archived || row.totalCostsPence > 0 : row.soldAt.slice(0, 10) >= period.from && row.soldAt.slice(0, 10) <= period.to);
  return { rows: tableRows, summary, funnel };
}
