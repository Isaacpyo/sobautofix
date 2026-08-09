import type { SaleVehicle } from "@/types/domain";

export function isSoldPageExpired(vehicle: SaleVehicle) {
  return (
    vehicle.status === "sold" &&
    Boolean(vehicle.soldAt) &&
    Date.now() - new Date(vehicle.soldAt!).getTime() > 90 * 86_400_000
  );
}
