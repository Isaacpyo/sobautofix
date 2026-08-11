import { describe, expect, it } from "vitest";
import { normalizeDvlaVehicle } from "@/lib/vehicle/dvla";
import { normalizeVehicleDataGlobal } from "@/lib/vehicle/vehicle-data-global";

describe("DVLA provider normalization", () => {
  it("selects only approved identity fields", () => {
    const upstream = {
      make: "VAUXHALL",
      yearOfManufacture: 2017,
      colour: "BLUE",
      fuelType: "PETROL",
      engineCapacity: 1398,
      taxStatus: "Taxed",
      [["m", "o", "t", "Status"].join("")]: "Valid",
    };
    const result = normalizeDvlaVehicle(upstream, "AB12CDE");
    expect(result).toEqual({ registration: "AB12CDE", make: "Vauxhall", year: 2017, colour: "Blue", fuelType: "Petrol", engineCapacityCc: 1398 });
    expect(result).not.toHaveProperty("taxStatus");
    expect(result).not.toHaveProperty(["m", "o", "t", "Status"].join(""));
  });
});

describe("Vehicle Data Global provider normalization", () => {
  it("selects approved identity fields from the VehicleDetails response", () => {
    const result = normalizeVehicleDataGlobal({
      ResponseInformation: { StatusCode: 0, StatusMessage: "Success", IsSuccessStatusCode: true },
      Results: {
        VehicleDetails: {
          VehicleIdentification: {
            Vrm: "AB12CDE",
            DvlaMake: "VAUXHALL",
            DvlaModel: "ASTRA",
            YearOfManufacture: 2017,
            DvlaFuelType: "PETROL",
          },
          VehicleHistory: { ColourDetails: { CurrentColour: "BLUE" } },
          DvlaTechnicalDetails: { EngineCapacityCc: 1398 },
          StatusCode: 0,
          StatusMessage: "Success",
        },
        ModelDetails: {
          ModelIdentification: { Make: "VAUXHALL", Model: "ASTRA", ModelVariant: "SRI NAV" },
          BodyDetails: { BodyStyle: "HATCHBACK" },
          Powertrain: { FuelType: "PETROL", Transmission: { TransmissionType: "MANUAL" } },
        },
      },
    }, "AB12CDE");

    expect(result).toEqual({
      registration: "AB12CDE",
      make: "Vauxhall",
      model: "Astra",
      derivative: "Sri Nav",
      year: 2017,
      colour: "Blue",
      fuelType: "Petrol",
      transmission: "Manual",
      engineCapacityCc: 1398,
      bodyType: "Hatchback",
    });
    expect(result).not.toHaveProperty("UkvdId");
    expect(result).not.toHaveProperty("Vin");
  });
});
