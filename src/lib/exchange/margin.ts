// Margin reporting for Costs & Reporting.
//
// Definition (shown to staff next to every figure):
//   Gross margin = selling price - (purchase price + recorded direct costs)
// Direct costs are the cost lines recorded against the vehicle: transport,
// preparation, repairs, parts, valeting, fees and other. Overheads, staff
// time, finance charges and tax (including VAT) are NOT included, so this is
// never labelled profit or net profit.
//
// A figure is "Estimated" when the vehicle is not yet sold or any included
// cost line is an estimate; it is "Actual" only when the sale is completed
// and every cost line is actual.

export type CostCategory = "purchase" | "transport" | "preparation" | "repair" | "parts" | "valeting" | "fees" | "other";
export type CostBasis = "estimated" | "actual";
export type CostLine = { category: CostCategory; amountPence: number; basis: CostBasis };

export const costCategoryLabels: Record<CostCategory, string> = {
  purchase: "Purchase price",
  transport: "Transport",
  preparation: "Preparation",
  repair: "Repairs",
  parts: "Parts",
  valeting: "Valeting",
  fees: "Fees",
  other: "Other",
};

export const MARGIN_DEFINITION = "Gross margin = selling price minus the purchase price and recorded direct costs. It excludes overheads, staff time, finance charges and tax, so it is not net profit.";

export type MarginSummary = {
  purchasePence: number;
  directCostsPence: number;
  totalCostPence: number;
  sellingPricePence: number;
  /** Where the selling price came from: an agreed/completed sale or the advertised price. */
  sellingPriceSource: "completed_sale" | "agreed_sale" | "advertised";
  grossMarginPence: number;
  /** Margin as a share of the selling price, or null when the price is zero. */
  marginPercent: number | null;
  basis: CostBasis;
  hasPurchaseCost: boolean;
};

export function poundsToPence(pounds: number) {
  return Math.round(pounds * 100);
}

export function summariseMargin(input: {
  costs: CostLine[];
  advertisedPricePounds: number;
  sale?: { agreedPricePence: number; completed: boolean } | null;
}): MarginSummary {
  const purchasePence = sum(input.costs.filter((cost) => cost.category === "purchase"));
  const directCostsPence = sum(input.costs.filter((cost) => cost.category !== "purchase"));
  const totalCostPence = purchasePence + directCostsPence;
  const sellingPricePence = input.sale ? input.sale.agreedPricePence : poundsToPence(input.advertisedPricePounds);
  const sellingPriceSource = input.sale ? (input.sale.completed ? "completed_sale" : "agreed_sale") : "advertised";
  const grossMarginPence = sellingPricePence - totalCostPence;
  const allActual = input.costs.every((cost) => cost.basis === "actual");
  return {
    purchasePence,
    directCostsPence,
    totalCostPence,
    sellingPricePence,
    sellingPriceSource,
    grossMarginPence,
    marginPercent: sellingPricePence > 0 ? Math.round((grossMarginPence / sellingPricePence) * 1000) / 10 : null,
    basis: sellingPriceSource === "completed_sale" && allActual ? "actual" : "estimated",
    hasPurchaseCost: input.costs.some((cost) => cost.category === "purchase"),
  };
}

/** Whole days between acquisition (or listing) and sale (or today). */
export function daysInStock(input: { acquiredOn?: string | null; listedAt?: string | null; createdAt: string; soldAt?: string | null }, now = new Date()) {
  const start = new Date(input.acquiredOn || input.listedAt || input.createdAt);
  const end = input.soldAt ? new Date(input.soldAt) : now;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: pence % 100 === 0 ? 0 : 2 }).format(pence / 100);
}

function sum(lines: CostLine[]) {
  return lines.reduce((total, line) => total + line.amountPence, 0);
}

// ---------------------------------------------------------------------------
// Costs & Reporting (delivery brief). Added functions only; the definitions
// below are shown on the reporting page next to the figures.
// ---------------------------------------------------------------------------

export const REPORT_DEFINITIONS: Array<{ term: string; definition: string }> = [
  { term: "Acquisition cost", definition: "The purchase cost lines recorded against the vehicle." },
  { term: "Transport", definition: "Transport cost lines." },
  { term: "Preparation and repair", definition: "Preparation, repair, parts and valeting cost lines." },
  { term: "Other direct costs", definition: "Fees and other cost lines." },
  { term: "Sale price", definition: "The agreed price of the completed sale. Before a sale completes, the advertised price is used and the figure is marked Estimated." },
  { term: "Recorded gross margin", definition: "Sale price minus acquisition, transport, preparation and repair, and other direct costs. Overheads, staff time, finance charges and tax are not included, so this is not net profit." },
  { term: "Days in stock", definition: "From the acquisition date (or the first listing date, or the date the record was created) to the sale date (or today)." },
];

export type CostBreakdown = { acquisitionPence: number; transportPence: number; preparationRepairPence: number; otherDirectPence: number; totalPence: number; allActual: boolean };

export function breakdownCosts(costs: CostLine[]): CostBreakdown {
  const total = (categories: CostCategory[]) => sum(costs.filter((cost) => categories.includes(cost.category)));
  const acquisitionPence = total(["purchase"]);
  const transportPence = total(["transport"]);
  const preparationRepairPence = total(["preparation", "repair", "parts", "valeting"]);
  const otherDirectPence = total(["fees", "other"]);
  return { acquisitionPence, transportPence, preparationRepairPence, otherDirectPence, totalPence: acquisitionPence + transportPence + preparationRepairPence + otherDirectPence, allActual: costs.every((cost) => cost.basis === "actual") };
}

/** Recorded gross margin in integer pence, per REPORT_DEFINITIONS. */
export function recordedGrossMargin(input: { costs: CostLine[]; advertisedPricePounds: number; completedSalePence?: number | null }) {
  const breakdown = breakdownCosts(input.costs);
  const completed = input.completedSalePence != null;
  const salePricePence = completed ? input.completedSalePence! : poundsToPence(input.advertisedPricePounds);
  return {
    ...breakdown,
    salePricePence,
    salePriceBasis: (completed ? "actual" : "estimated") as CostBasis,
    grossMarginPence: salePricePence - breakdown.totalPence,
    basis: (completed && breakdown.allActual ? "actual" : "estimated") as CostBasis,
  };
}
