import "server-only";

import { DvlaProvider } from "./dvla";
import { mockVehicleProvider } from "./mock";
import type { VehicleLookupProvider } from "./provider";
import { VehicleDataGlobalProvider } from "./vehicle-data-global";

export function getConfiguredVehicleProvider(): VehicleLookupProvider | null {
  const providerName = process.env.VEHICLE_LOOKUP_PROVIDER || "vehicle-data-global";
  if (process.env.PLAYWRIGHT_TEST === "true" && providerName === "mock") return mockVehicleProvider;
  if (providerName === "dvla" && process.env.DVLA_API_KEY) return new DvlaProvider(process.env.DVLA_API_KEY);
  if (providerName === "vehicle-data-global" && process.env.VEHICLE_DATA_GLOBAL_API_KEY && process.env.VEHICLE_DATA_GLOBAL_BASE_URL && process.env.VEHICLE_DATA_GLOBAL_PACKAGE) {
    return new VehicleDataGlobalProvider(
      process.env.VEHICLE_DATA_GLOBAL_API_KEY,
      process.env.VEHICLE_DATA_GLOBAL_BASE_URL,
      process.env.VEHICLE_DATA_GLOBAL_PACKAGE,
    );
  }
  return null;
}
