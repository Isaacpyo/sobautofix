import type { VehicleDetails } from "@/types/domain";

export interface VehicleLookupProvider {
  lookup(registration: string): Promise<VehicleDetails>;
}

export class VehicleLookupError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "invalid" | "rate_limited" | "unavailable",
  ) {
    super(message);
  }
}
