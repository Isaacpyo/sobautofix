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
