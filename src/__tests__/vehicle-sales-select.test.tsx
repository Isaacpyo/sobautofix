// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VehicleMakeModelFields } from "@/components/admin/vehicle-make-model-fields";
import { VehicleSalesSelect } from "@/components/admin/vehicle-sales-select";
import { getVehicleYearOptions, VehicleYearSelect } from "@/components/admin/vehicle-year-select";
import { vehicleMakes, vehicleModelsByMake, vehicleSalesOptions } from "@/lib/vehicle/sales-options";

describe("vehicle sales dropdowns", () => {
  it("provides a comprehensive make catalogue and detailed model mappings", () => {
    expect(vehicleMakes.length).toBeGreaterThanOrEqual(45);
    expect(vehicleModelsByMake.Ford).toEqual(expect.arrayContaining(["Fiesta", "Focus", "Kuga", "Puma", "Transit"]));
    expect(vehicleModelsByMake.Toyota).toEqual(expect.arrayContaining(["Aygo", "Corolla", "RAV4", "Yaris"]));
    expect(vehicleSalesOptions.fuelType).toContain("Petrol");
    expect(vehicleSalesOptions.transmission).toContain("Manual");
    expect(vehicleSalesOptions.engineSize).toContain("1.0L");
    expect(vehicleSalesOptions.colour).toContain("Magnetic Grey");
    expect(vehicleSalesOptions.bodyType).toContain("Hatchback");
  });

  it("loads the appropriate models when a make is selected", () => {
    render(<VehicleMakeModelFields />);
    fireEvent.change(screen.getByLabelText("Make"), { target: { value: "Ford" } });
    const model = screen.getByLabelText("Model");
    expect(model).toHaveTextContent("Focus");
    expect(model).toHaveTextContent("Fiesta");
    expect(model).not.toHaveTextContent("Qashqai");
    fireEvent.change(screen.getByLabelText("Make"), { target: { value: "Nissan" } });
    expect(model).toHaveTextContent("Qashqai");
    expect(model).not.toHaveTextContent("Focus");
  });

  it("preserves non-standard current make, model and field values", () => {
    const { unmount } = render(<VehicleMakeModelFields initialMake="Rare Make" initialModel="Custom Model" />);
    expect(screen.getByLabelText("Make")).toHaveValue("Rare Make");
    expect(screen.getByLabelText("Model")).toHaveValue("Custom Model");
    unmount();
    render(<VehicleSalesSelect name="colour" value="Bespoke Pearl" />);
    expect(screen.getByRole("combobox")).toHaveValue("Bespoke Pearl");
  });

  it("lists inventory years newest first and advances with the calendar year", () => {
    const years = getVehicleYearOptions(2026);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(2008);
    expect(getVehicleYearOptions(2027)[0]).toBe(2027);

    render(<VehicleYearSelect value={2020} />);
    const select = screen.getByRole("combobox");
    const currentYear = new Date().getFullYear();
    expect(select).toHaveValue("2020");
    expect(Array.from(select.querySelectorAll("option")).slice(1, 4).map((option) => option.textContent)).toEqual([currentYear, currentYear - 1, currentYear - 2].map(String));
  });
});
