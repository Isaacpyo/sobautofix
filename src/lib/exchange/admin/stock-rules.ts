import "server-only";

import { stockStatusLabels } from "@/components/admin/exchange/labels";
import type { ExchangePermission } from "@/lib/exchange/permissions";
import { canTransition, type PublishReadiness } from "@/lib/exchange/readiness";
import type { SaleVehicleStatus } from "@/types/domain";

export type StatusChangeInput = {
  from: SaleVehicleStatus;
  to: SaleVehicleStatus;
  can: (permission: ExchangePermission) => boolean;
  readiness: PublishReadiness;
  /** A reservation that is not completed or cancelled. */
  hasActiveSale: boolean;
  /** A completed sale record exists for this vehicle. */
  hasCompletedSale: boolean;
};

const listedStatuses: SaleVehicleStatus[] = ["available", "reserved", "sold"];

/** Permission needed to move between two stock statuses. */
export function permissionForStatusChange(from: SaleVehicleStatus, to: SaleVehicleStatus): ExchangePermission {
  // Anything that puts a car in front of visitors, or takes it away, is publishing.
  if (listedStatuses.includes(from) || listedStatuses.includes(to) || to === "archived" || from === "archived") return "stock.publish";
  return "stock.edit";
}

/**
 * The one rulebook for stock status changes. Returns a message staff can act
 * on, or null when the change is allowed. Reservations and completed sales go
 * through vehicle_sales so the price, deposit and handover are recorded; the
 * database trigger then keeps the stock status in step.
 */
export function statusChangeProblem(input: StatusChangeInput): string | null {
  const { from, to } = input;
  if (from === to) return `This vehicle is already ${stockStatusLabels[to]}.`;
  if (!canTransition(from, to)) return `A ${stockStatusLabels[from]} vehicle cannot move straight to ${stockStatusLabels[to]}.`;
  const permission = permissionForStatusChange(from, to);
  const draftWork = permission === "stock.edit" && (input.can("stock.edit") || input.can("prep.manage"));
  if (!input.can(permission) && !draftWork) {
    return permission === "stock.publish" ? "Only an owner or manager can publish, withdraw or relist vehicles." : "You do not have permission to change this vehicle's status.";
  }
  if (to === "reserved") return "Reserve a vehicle from its sales enquiry or from Sales & Handover so the agreed price and deposit are recorded.";
  if (from === "reserved" && input.hasActiveSale) return "This vehicle has an active reservation. Cancel or complete it in Sales & Handover instead.";
  if (to === "sold" && input.hasActiveSale) return "Complete the sale in Sales & Handover; the vehicle is then marked as sold automatically.";
  if (from === "sold" && input.hasCompletedSale && to !== "archived") return "This vehicle has a completed sale record in Sales & Handover, so it cannot be relisted from here.";
  if (to === "archived" && input.hasActiveSale) return "Cancel the active reservation in Sales & Handover before withdrawing this vehicle.";
  if (to === "available" && !input.readiness.ready) return `Finish the publishing checklist first: ${input.readiness.missing.join("; ")}.`;
  return null;
}

/** Column changes that go with a status change. */
export function statusChangeColumns(from: SaleVehicleStatus, to: SaleVehicleStatus, current: { listedAt?: string | null; soldAt?: string | null }, now = new Date()) {
  const stamp = now.toISOString();
  const row: Record<string, string | null> = { status: to };
  if (to === "available") {
    row.listed_at = current.listedAt || stamp;
    row.reserved_at = null;
    row.sold_at = null;
  } else if (to === "sold") {
    // Keep the original sale date so the 90-day sold window is not restarted.
    row.sold_at = from === "sold" && current.soldAt ? current.soldAt : stamp;
    row.reserved_at = null;
  } else if (to !== "archived" || from !== "sold") {
    row.reserved_at = null;
    if (from === "sold") row.sold_at = null;
  }
  return row;
}
