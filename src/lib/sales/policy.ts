import type { SaleVehicle } from "@/types/domain";

const WORKFLOW_TEST_DESCRIPTION = "Test stock vehicle for validating the SOB Autofix inventory and sales workflow.";

export function isPublicDeliveryListing(vehicle: Pick<SaleVehicle, "description">) {
  return !vehicle.description.includes(WORKFLOW_TEST_DESCRIPTION);
}

export function isSoldPageExpired(vehicle: SaleVehicle) {
  return (
    vehicle.status === "sold" &&
    Boolean(vehicle.soldAt) &&
    Date.now() - new Date(vehicle.soldAt!).getTime() > 90 * 86_400_000
  );
}
