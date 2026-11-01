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

type LookupFailureCode = "not_found" | "invalid" | "unavailable";

/**
 * Decides why a lookup that returned HTTP 200 produced no vehicle. The upstream
 * wording varies ("Vehicle Not Found", "No Match Found", "NoResults"), so match
 * the phrases loosely. Account problems (key, package, credit) mention "not
 * found" too and must stay "unavailable" so staff are not told the car is
 * unknown when the service itself is broken.
 */
export function classifyVehicleDataGlobalFailure(response: VehicleDataGlobalResponse): LookupFailureCode {
  const status = response.ResponseInformation;
  const vehicleStatus = response.Results?.VehicleDetails;
  const message = `${status?.StatusMessage || ""} ${vehicleStatus?.StatusMessage || ""}`.toLowerCase().replace(/[\s_-]+/g, "");
  if (/key|package|account|credit|subscription|unauthori[sz]ed|forbidden/.test(message)) return "unavailable";
  if (/notfound|nomatch|noresult|nodata|novehicle|unknownvrm/.test(message)) return "not_found";
  if (message.includes("invalid")) return "invalid";
  // The request itself succeeded but the vehicle block did not: the service
  // answered, it just has no vehicle for this registration.
  if (status?.IsSuccessStatusCode && status.StatusCode === 0 && !vehicleStatus?.VehicleIdentification) return "not_found";
  return "unavailable";
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
        const code = classifyVehicleDataGlobalFailure(payload);
        // Status codes and upstream wording only, with the registration removed,
        // so the next unexpected reply can be diagnosed from the logs.
        console.warn("Vehicle Data Global lookup failed", { code, statusCode: status?.StatusCode, statusMessage: redact(status?.StatusMessage, registration), vehicleStatusCode: vehicleStatus?.StatusCode, vehicleStatusMessage: redact(vehicleStatus?.StatusMessage, registration) });
        if (code === "not_found") throw new VehicleLookupError("Vehicle not found", "not_found");
        if (code === "invalid") throw new VehicleLookupError("Invalid registration", "invalid");
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

function redact(message: string | undefined, registration: string) {
  const characters = registration.replace(/[^a-z0-9]/gi, "").split("");
  if (!message || characters.length === 0) return message;
  // Matches "AB12CDE" and "AB12 CDE" alike.
  return message.replace(new RegExp(characters.join("\\s*"), "gi"), "[registration]");
}
