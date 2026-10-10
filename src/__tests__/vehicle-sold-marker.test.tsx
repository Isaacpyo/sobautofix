// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VehicleEditor } from "@/components/admin/vehicle-editor";
import { InventoryGrid } from "@/components/sales/inventory-grid";
import type { SaleVehicle } from "@/types/domain";

vi.mock("next/image", () => ({ default: () => null }));

const soldVehicle: SaleVehicle = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "sold-ford-focus",
  make: "Ford",
  model: "Focus",
  year: 2020,
  mileage: 40_000,
  price: 9_000,
  fuelType: "Diesel",
  transmission: "Manual",
  description: "A genuine sold vehicle used to verify the public marker.",
  features: [],
  images: [],
  status: "sold",
  soldAt: "2026-10-01T12:00:00.000Z",
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
};

describe("sold vehicle controls and markers", () => {
  it("offers an explicit sold option in the admin editor", () => {
    render(<VehicleEditor vehicle={soldVehicle} action={vi.fn()} />);
    expect(screen.getByRole("option", { name: "This car has been sold" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sale status" })).toHaveValue("sold");
  });

  it("renders a prominent sold marker on the public stock card", () => {
    render(<InventoryGrid vehicles={[soldVehicle]} />);
    expect(screen.getByText("Sold", { selector: "span" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Ford Focus/i })).toHaveAttribute("href", "/cars-for-sale/sold-ford-focus");
  });
});
