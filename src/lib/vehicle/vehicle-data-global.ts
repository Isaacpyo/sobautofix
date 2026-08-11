import { titleCase } from "@/lib/utils";
import type { VehicleDetails } from "@/types/domain";
import { VehicleLookupError, type VehicleLookupProvider } from "./provider";

type VehicleDataGlobalResponse = {
  ResponseInformation?: {
    StatusCode?: number;
    StatusMessage?: string;
    IsSuccessStatusCode?: boolean;
  };
  Results?: {
    VehicleDetails?: {
      VehicleIdentification?: {
        Vrm?: string;
        DvlaMake?: string;
        DvlaModel?: string;
        YearOfManufacture?: number;
        DvlaBodyType?: string;
        DvlaFuelType?: string;
      };
      VehicleHistory?: { ColourDetails?: { CurrentColour?: string } };
      DvlaTechnicalDetails?: { EngineCapacityCc?: number };
      StatusCode?: number;
      StatusMessage?: string;
    };
    ModelDetails?: {
      ModelIdentification?: { Make?: string; Model?: string; ModelVariant?: string };
      BodyDetails?: { BodyStyle?: string; BodyShape?: string };
      Powertrain?: {
        FuelType?: string;
        Transmission?: { TransmissionType?: string };
      };
    };
  };
};

export function normalizeVehicleDataGlobal(response: VehicleDataGlobalResponse, registration: string): VehicleDetails {
  const identity = response.Results?.VehicleDetails?.VehicleIdentification;
  const history = response.Results?.VehicleDetails?.VehicleHistory;
  const technical = response.Results?.VehicleDetails?.DvlaTechnicalDetails;
  const model = response.Results?.ModelDetails?.ModelIdentification;
  const body = response.Results?.ModelDetails?.BodyDetails;
  const powertrain = response.Results?.ModelDetails?.Powertrain;

  return {
    registration: identity?.Vrm || registration,
    make: titleCase(model?.Make || identity?.DvlaMake),
    model: titleCase(model?.Model || identity?.DvlaModel),
    derivative: titleCase(model?.ModelVariant),
    year: identity?.YearOfManufacture,
    colour: titleCase(history?.ColourDetails?.CurrentColour),
    fuelType: titleCase(powertrain?.FuelType || identity?.DvlaFuelType),
    transmission: titleCase(powertrain?.Transmission?.TransmissionType),
    engineCapacityCc: technical?.EngineCapacityCc,
    bodyType: titleCase(body?.BodyStyle || body?.BodyShape || identity?.DvlaBodyType),
  };
}

export class VehicleDataGlobalProvider implements VehicleLookupProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly packageName: string,
    private readonly timeoutMs = 6500,
  ) {}

  async lookup(registration: string): Promise<VehicleDetails> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL("/r2/lookup", this.baseUrl);
      url.searchParams.set("ApiKey", this.apiKey);
      url.searchParams.set("PackageName", this.packageName);
      url.searchParams.set("Vrm", registration);

      const response = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
      if (response.status === 404) throw new VehicleLookupError("Vehicle not found", "not_found");
      if (response.status === 400) throw new VehicleLookupError("Invalid registration", "invalid");
      if (response.status === 429) throw new VehicleLookupError("Too many lookups", "rate_limited");
      if (!response.ok) throw new VehicleLookupError("Vehicle service unavailable", "unavailable");

      const payload = await response.json() as VehicleDataGlobalResponse;
      const status = payload.ResponseInformation;
      const vehicleStatus = payload.Results?.VehicleDetails;
      if (!status?.IsSuccessStatusCode || status.StatusCode !== 0 || !vehicleStatus || vehicleStatus.StatusCode !== 0) {
        const message = `${status?.StatusMessage || ""} ${vehicleStatus?.StatusMessage || ""}`.toLowerCase();
        if (message.includes("not found") || message.includes("notfound")) throw new VehicleLookupError("Vehicle not found", "not_found");
        if (message.includes("invalid")) throw new VehicleLookupError("Invalid registration", "invalid");
        throw new VehicleLookupError("Vehicle service unavailable", "unavailable");
      }

      return normalizeVehicleDataGlobal(payload, registration);
    } catch (error) {
      if (error instanceof VehicleLookupError) throw error;
      throw new VehicleLookupError("Vehicle service unavailable", "unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }
}
