import type { SaleVehicle } from "@/types/domain";

export type ReadinessCheck = { key: string; label: string; passed: boolean };

export type PublishReadiness = { ready: boolean; checks: ReadinessCheck[]; missing: string[] };

type ReadinessInput = Pick<
  SaleVehicle,
  "make" | "model" | "year" | "mileage" | "price" | "fuelType" | "transmission" | "description" | "images" | "conditionSummary" | "listingCondition" | "writeOffStatus" | "knownFaults"
> & { knownFaultsReviewed?: boolean };

/**
 * A vehicle may only go on sale with core specifications, a price,
 * photographs and a condition disclosure. Unknown history is allowed, but
 * it must be stated ("Not confirmed"), never hidden or guessed.
 */
export function getPublishReadiness(vehicle: ReadinessInput, options: { minimumPhotos: number }): PublishReadiness {
  const checks: ReadinessCheck[] = [
    { key: "specs", label: "Make, model, year, mileage, fuel and transmission", passed: Boolean(vehicle.make?.trim() && vehicle.model?.trim() && vehicle.year > 1885 && vehicle.mileage >= 0 && vehicle.fuelType?.trim() && vehicle.transmission?.trim()) },
    { key: "price", label: "An advertised price above £0", passed: Number.isInteger(vehicle.price) && vehicle.price > 0 },
    { key: "description", label: "A description of at least 20 characters", passed: (vehicle.description?.trim().length || 0) >= 20 },
    { key: "photos", label: `At least ${options.minimumPhotos} photographs`, passed: vehicle.images.length >= options.minimumPhotos },
    { key: "condition", label: "A condition summary of at least 20 characters", passed: (vehicle.conditionSummary?.trim().length || 0) >= 20 },
    {
      key: "repairProject",
      label: "Known faults listed for a repair project",
      passed: vehicle.listingCondition !== "repair_project" || vehicle.knownFaults.some((fault) => fault.trim().length > 0),
    },
  ];
  const missing = checks.filter((check) => !check.passed).map((check) => check.label);
  return { ready: missing.length === 0, checks, missing };
}

/** Status changes a listing may make. Withdrawn is stored as "archived". */
export const stockTransitions: Record<SaleVehicle["status"], SaleVehicle["status"][]> = {
  draft: ["preparation", "available", "archived"],
  preparation: ["draft", "available", "archived"],
  available: ["preparation", "reserved", "sold", "archived"],
  reserved: ["available", "sold", "archived"],
  sold: ["available", "archived"],
  archived: ["draft", "preparation", "available"],
};

export function canTransition(from: SaleVehicle["status"], to: SaleVehicle["status"]) {
  return from === to || stockTransitions[from].includes(to);
}

/** Statuses that put a listing in front of visitors and so need readiness. */
export const publicStatuses: ReadonlyArray<SaleVehicle["status"]> = ["available", "reserved"];
