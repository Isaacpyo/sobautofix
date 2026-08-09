import type { VehicleLookupProvider } from "./provider";

export const mockVehicleProvider: VehicleLookupProvider = {
  async lookup(registration) {
    return { registration, make: "Vauxhall", model: "Astra", year: 2017, fuelType: "Petrol" };
  },
};
