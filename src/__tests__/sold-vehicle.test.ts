import { afterEach, describe, expect, it, vi } from "vitest";
import { isSoldPageExpired } from "@/lib/sales/policy";
import type { SaleVehicle } from "@/types/domain";

const vehicle: SaleVehicle = { id: "1", slug: "test-car", make: "Ford", model: "Focus", year: 2020, mileage: 40000, price: 9000, fuelType: "Diesel", transmission: "Manual", description: "A genuine test vehicle used only by automated tests.", features: [], images: [], status: "sold", soldAt: "2026-01-01T00:00:00.000Z", createdAt: "2025-01-01T00:00:00.000Z" };

describe("sold vehicle lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  it("retains a recently sold page", () => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-02-01")); expect(isSoldPageExpired(vehicle)).toBe(false); });
  it("expires a sold page after 90 days", () => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-05-01")); expect(isSoldPageExpired(vehicle)).toBe(true); });
});
