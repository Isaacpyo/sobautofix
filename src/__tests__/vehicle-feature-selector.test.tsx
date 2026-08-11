// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VehicleFeatureSelector } from "@/components/admin/vehicle-feature-selector";
import { commonVehicleFeatures } from "@/lib/sales/vehicle-features";

describe("vehicle feature selector", () => {
  it("offers a broad researched UK-marketplace feature vocabulary", () => {
    expect(commonVehicleFeatures.length).toBeGreaterThan(80);
    expect(commonVehicleFeatures).toEqual(expect.arrayContaining(["Apple CarPlay", "Rear parking sensors", "Adaptive cruise control", "Reversing camera", "Heated front seats", "LED headlights"]));
  });

  it("searches, selects and removes multiple features", async () => {
    const user = userEvent.setup();
    const { container } = render(<VehicleFeatureSelector />);
    const search = screen.getByRole("combobox", { name: "Features" });
    await user.type(search, "parking sensors");
    await user.click(screen.getByRole("option", { name: "Rear parking sensors" }));
    await user.type(search, "Apple CarPlay");
    await user.click(screen.getByRole("option", { name: "Apple CarPlay" }));
    expect(container.querySelector<HTMLInputElement>('input[name="features"]')?.value).toBe("Rear parking sensors\nApple CarPlay");
    await user.click(screen.getByRole("button", { name: "Remove Rear parking sensors" }));
    expect(container.querySelector<HTMLInputElement>('input[name="features"]')?.value).toBe("Apple CarPlay");
  });

  it("allows a verified custom feature", async () => {
    const user = userEvent.setup();
    const { container } = render(<VehicleFeatureSelector />);
    await user.type(screen.getByRole("combobox", { name: "Features" }), "Load-through ski hatch");
    await user.click(screen.getByRole("button", { name: "Add “Load-through ski hatch”" }));
    expect(container.querySelector<HTMLInputElement>('input[name="features"]')?.value).toBe("Load-through ski hatch");
  });
});
