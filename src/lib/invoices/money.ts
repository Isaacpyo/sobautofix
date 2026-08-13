const poundsPattern = /^\d{1,13}(?:\.\d{0,2})?$/;
const quantityPattern = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/;

export function poundsToPence(value: string): bigint {
  const normalized = value.trim().replace(/^£/, "").replaceAll(",", "");
  if (!poundsPattern.test(normalized)) throw new Error("Enter a valid GBP amount with no more than two decimal places.");
  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

export function quantityToThousandths(value: string): bigint {
  const normalized = value.trim();
  if (!quantityPattern.test(normalized)) throw new Error("Enter a positive quantity with no more than three decimal places.");
  const [whole = "0", fraction = ""] = normalized.split(".");
  const scaled = BigInt(whole) * 1_000n + BigInt((fraction + "000").slice(0, 3));
  if (scaled <= 0n) throw new Error("Quantity must be greater than zero.");
  return scaled;
}

export function calculateLineTotalPence(quantity: string, unitPricePence: bigint) {
  if (unitPricePence < 0n) throw new Error("Unit price cannot be negative.");
  return (quantityToThousandths(quantity) * unitPricePence + 500n) / 1_000n;
}

export function calculateInvoiceTotals(items: Array<{ quantity: string; unitPricePence: bigint }>, discountPence = 0n, taxPence = 0n) {
  if (discountPence < 0n || taxPence < 0n) throw new Error("Invoice adjustments cannot be negative.");
  const subtotalPence = items.reduce((total, item) => total + calculateLineTotalPence(item.quantity, item.unitPricePence), 0n);
  const totalPence = subtotalPence - discountPence + taxPence;
  if (totalPence < 0n) throw new Error("Discount cannot exceed the invoice amount.");
  return { subtotalPence, discountPence, taxPence, totalPence };
}

export function formatPence(value: bigint | number | string) {
  const pence = typeof value === "bigint" ? value : BigInt(value);
  const sign = pence < 0n ? "-" : "";
  const absolute = pence < 0n ? -pence : pence;
  return `${sign}£${String(absolute / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${String(absolute % 100n).padStart(2, "0")}`;
}
