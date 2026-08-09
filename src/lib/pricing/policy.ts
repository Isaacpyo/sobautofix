import type { ServicePrice } from "@/types/domain";

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export function servicePriceLabel(price: ServicePrice): string | undefined {
  if (price.label?.trim()) return price.label.trim();
  if (price.minimum != null && price.maximum != null) return `${pounds.format(price.minimum)}–${pounds.format(price.maximum)}`;
  if (price.minimum != null) return `From ${pounds.format(price.minimum)}`;
  if (price.maximum != null) return `Up to ${pounds.format(price.maximum)}`;
  return undefined;
}
