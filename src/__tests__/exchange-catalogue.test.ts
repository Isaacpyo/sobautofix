import { describe, expect, it } from "vitest";
import { bottomNavSection, isActivePath } from "@/components/exchange/exchange-nav";
import { activeFilterChips, activeFilterCount, buildFilterOptions, catalogueQueryString, filterVehicles, parseCatalogueFilters, sortVehicles } from "@/lib/exchange/public/catalogue";
import type { SaleVehicle } from "@/types/domain";

function car(overrides: Partial<SaleVehicle>): SaleVehicle {
  return {
    id: overrides.slug || "id", slug: "car", make: "Ford", model: "Focus", year: 2019, mileage: 40_000, price: 9_000, fuelType: "Petrol", transmission: "Manual",
    description: "", features: [], images: [], status: "available", createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z",
    listingCondition: "ready_to_drive", writeOffStatus: "not_confirmed", knownFaults: [], workCompleted: [], serviceHistory: "not_confirmed",
    ...overrides,
  };
}

const stock = [
  car({ slug: "focus", make: "Ford", model: "Focus", price: 9495, mileage: 41250, year: 2019, listedAt: "2026-10-22T10:00:00Z" }),
  car({ slug: "fiesta", make: "Ford", model: "Fiesta", price: 6250, mileage: 70500, year: 2016, listedAt: "2026-10-10T10:00:00Z" }),
  car({ slug: "astra", make: "Vauxhall", model: "Astra", price: 6750, mileage: 68900, year: 2017, listedAt: "2026-10-14T10:00:00Z" }),
  car({ slug: "yaris", make: "Toyota", model: "Yaris", price: 13995, mileage: 28400, year: 2020, fuelType: "Hybrid", transmission: "Automatic", status: "reserved", listedAt: "2026-10-27T10:00:00Z" }),
  car({ slug: "bmw", make: "BMW", model: "3 Series", price: 3450, mileage: 121000, year: 2015, fuelType: "Diesel", transmission: "Automatic", listingCondition: "repair_project", writeOffStatus: "cat_n", listedAt: "2026-10-25T10:00:00Z" }),
];

describe("catalogue filters in the query string", () => {
  it("parses known filters and drops malformed values", () => {
    const filters = parseCatalogueFilters({ make: "Ford", maxPrice: "10000", minYear: "abc", condition: "salvage", sort: "price_asc", maxMileage: ["50000", "1"] });
    expect(filters).toEqual(expect.objectContaining({ make: "Ford", maxPrice: 10000, minYear: undefined, condition: undefined, sort: "price_asc", maxMileage: 50000 }));
  });

  it("defaults to newest listed and round-trips through a shareable query string", () => {
    const filters = parseCatalogueFilters(new URLSearchParams("make=Ford&fuel=Petrol&sort=newest"));
    expect(filters.sort).toBe("newest");
    expect(catalogueQueryString(filters)).toBe("?make=Ford&fuel=Petrol");
    expect(parseCatalogueFilters(new URLSearchParams(catalogueQueryString(filters).slice(1)))).toEqual(filters);
    expect(catalogueQueryString({ sort: "newest" })).toBe("");
  });

  it("filters by make, price, mileage, year, fuel, gearbox and condition", () => {
    const run = (query: string) => filterVehicles(stock, parseCatalogueFilters(new URLSearchParams(query))).map((vehicle) => vehicle.slug);
    expect(run("make=ford")).toEqual(["focus", "fiesta"]);
    expect(run("make=Ford&model=Fiesta")).toEqual(["fiesta"]);
    expect(run("minPrice=6000&maxPrice=10000")).toEqual(["focus", "astra", "fiesta"]);
    expect(run("maxMileage=50000")).toEqual(["focus", "yaris"]);
    expect(run("minYear=2019")).toEqual(["focus", "yaris"]);
    expect(run("fuel=Diesel&transmission=Automatic")).toEqual(["bmw"]);
    expect(run("condition=repair_project")).toEqual(["bmw"]);
  });

  it("sorts available cars before reserved ones in every order", () => {
    expect(sortVehicles(stock, "newest").map((vehicle) => vehicle.slug)).toEqual(["bmw", "focus", "astra", "fiesta", "yaris"]);
    expect(sortVehicles(stock, "price_asc").map((vehicle) => vehicle.slug)).toEqual(["bmw", "fiesta", "astra", "focus", "yaris"]);
    expect(sortVehicles(stock, "price_desc").map((vehicle) => vehicle.slug)).toEqual(["focus", "astra", "fiesta", "bmw", "yaris"]);
    expect(sortVehicles(stock, "mileage_asc").map((vehicle) => vehicle.slug)).toEqual(["focus", "astra", "fiesta", "bmw", "yaris"]);
  });

  it("lists the full range of standard values with live counts and only shows models for the chosen make", () => {
    const options = buildFilterOptions(stock, parseCatalogueFilters({}), new Date("2026-10-30T12:00:00Z"));
    const count = (list: { value: string; count: number }[], value: string) => list.find((option) => option.value === value)?.count;
    // Every standard make is offered, with the stock count (0 when none in stock).
    expect(options.make.length).toBeGreaterThan(20);
    expect(count(options.make, "Ford")).toBe(2);
    expect(count(options.make, "BMW")).toBe(1);
    expect(count(options.make, "Audi")).toBe(0);
    expect(options.make.map((option) => option.label)).toEqual([...options.make.map((option) => option.label)].sort((a, b) => a.localeCompare(b, "en-GB")));
    expect(options.model).toEqual([]);
    expect(options.condition.map((option) => option.value)).toEqual(["ready_to_drive", "repair_project"]);
    expect(options.fuel.map((option) => option.value)).toEqual(expect.arrayContaining(["Petrol", "Diesel", "Electric", "Plug-in Hybrid"]));
    expect(options.transmission.map((option) => option.value)).toEqual(expect.arrayContaining(["Manual", "Automatic"]));
    // Every price, mileage and year step is offered with its count.
    expect(options.minPrice.map((option) => option.value)).toContain("1000");
    expect(options.maxPrice.map((option) => option.value)).toContain("100000");
    expect(options.maxMileage).toHaveLength(10);
    expect(options.minYear[0]).toMatchObject({ value: "2026", label: "2026 or newer" });
    expect(options.minYear.map((option) => option.value)).toContain("2000");
    for (const option of options.maxPrice) expect(option.count).toBe(stock.filter((vehicle) => vehicle.price <= Number(option.value)).length);

    const ford = buildFilterOptions(stock, parseCatalogueFilters({ make: "Ford" }));
    // Models come from the standard list for the make, plus any in stock.
    expect(ford.model.map((option) => option.value)).toEqual(expect.arrayContaining(["Fiesta", "Focus"]));
    expect(count(ford.model, "Fiesta")).toBe(1);
    // Other facets narrow their counts to the chosen make; the make facet still counts every make.
    expect(count(ford.fuel, "Petrol")).toBe(2);
    expect(count(ford.fuel, "Diesel")).toBe(0);
    expect(count(ford.make, "BMW")).toBe(1);
  });

  it("keeps a selected value visible even when it no longer narrows the list", () => {
    const options = buildFilterOptions(stock, parseCatalogueFilters({ maxPrice: "100000" }));
    expect(options.maxPrice.some((option) => option.value === "100000")).toBe(true);
  });

  it("builds removable chips; removing the make also removes the model", () => {
    const filters = parseCatalogueFilters({ make: "Ford", model: "Focus", maxPrice: "10000", sort: "price_asc" });
    expect(activeFilterCount(filters)).toBe(3);
    const chips = activeFilterChips(filters);
    expect(chips.map((chip) => chip.label)).toEqual(["Ford", "Focus", "Up to £10,000"]);
    expect(chips[0]?.query).toBe("?maxPrice=10000&sort=price_asc");
  });
});

describe("exchange navigation state", () => {
  it("maps pages to the bottom navigation on both hosts", () => {
    expect(bottomNavSection("/")).toBe("home");
    expect(bottomNavSection("/exchange")).toBe("home");
    expect(bottomNavSection("/exchange/cars/demo-ford")).toBe("cars");
    expect(bottomNavSection("/sell")).toBe("sell");
    expect(bottomNavSection("/policies/complaints")).toBe("more");
    expect(isActivePath("/exchange/cars/sold", "/cars")).toBe(true);
    expect(isActivePath("/about", "/contact")).toBe(false);
  });
});
