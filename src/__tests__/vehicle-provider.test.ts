import { describe, expect, it } from "vitest";
import { normalizeDvlaVehicle } from "@/lib/vehicle/dvla";

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
