"use client";

import { changeStockStatusAction } from "@/app/admin/(protected)/exchange/stock/actions";
import type { SaleVehicleStatus } from "@/types/domain";
import { ActionForm, ConfirmButton } from "./forms";
import { cn } from "@/lib/utils";

/**
 * The quick "Mark as sold" / "Relist" control. It goes through the same
 * status service as the editor, so readiness and reservations are respected.
 */
export function StockSoldToggle({ vehicle, hasActiveSale, compact = false }: { vehicle: { id: string; status: SaleVehicleStatus; name: string; updatedAt?: string }; hasActiveSale: boolean; compact?: boolean }) {
  const markSold = vehicle.status === "available" || (vehicle.status === "reserved" && !hasActiveSale);
  const relist = vehicle.status === "sold";
  if (!markSold && !relist) return null;
  return <ActionForm action={changeStockStatusAction} hidden={{ vehicleId: vehicle.id, status: markSold ? "sold" : "available", updatedAt: vehicle.updatedAt }} successMessage={!compact} className={cn(compact ? "max-w-48" : "")}>
    {markSold
      ? <ConfirmButton variant="dangerSolid" className="min-h-10 px-3 text-xs" title="Mark as sold?" message={`Mark the ${vehicle.name} as sold? A sold banner shows on the public listing for 90 days. Use Sales & Handover instead if you want to record the price and payment.`} confirmLabel="Mark as sold">Mark as sold</ConfirmButton>
      : <ConfirmButton variant="secondary" tone="warning" className="min-h-10 px-3 text-xs" title="Relist this vehicle?" message={`Put the ${vehicle.name} back on sale? The sold banner is removed and the car shows as available. The publishing checklist must still be complete.`} confirmLabel="Relist">Relist</ConfirmButton>}
  </ActionForm>;
}
