import { titleCase } from "@/lib/utils";
import type { VehicleDetails } from "@/types/domain";
import { VehicleLookupError, type VehicleLookupProvider } from "./provider";

type DvlaResponse = {
  registrationNumber?: string;
  make?: string;
  yearOfManufacture?: number;
  colour?: string;
  fuelType?: string;
  engineCapacity?: number;
  [key: string]: unknown;
};

export function normalizeDvlaVehicle(response: DvlaResponse, registration: string): VehicleDetails {
  // Deliberately select only approved vehicle identity fields. Other upstream
  // data is discarded and must never cross this provider boundary.
  return {
    registration,
    make: titleCase(response.make),
    year: response.yearOfManufacture,
    colour: titleCase(response.colour),
    fuelType: titleCase(response.fuelType),
    engineCapacityCc: response.engineCapacity,
  };
}

export class DvlaProvider implements VehicleLookupProvider {
  constructor(private readonly apiKey: string, private readonly timeoutMs = 6500) {}

  async lookup(registration: string): Promise<VehicleDetails> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify({ registrationNumber: registration }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 404) throw new VehicleLookupError("Vehicle not found", "not_found");
      if (response.status === 400) throw new VehicleLookupError("Invalid registration", "invalid");
      if (response.status === 429) throw new VehicleLookupError("Too many lookups", "rate_limited");
      if (!response.ok) throw new VehicleLookupError("Vehicle service unavailable", "unavailable");

      return normalizeDvlaVehicle((await response.json()) as DvlaResponse, registration);
    } catch (error) {
      if (error instanceof VehicleLookupError) throw error;
      throw new VehicleLookupError("Vehicle service unavailable", "unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }
}
