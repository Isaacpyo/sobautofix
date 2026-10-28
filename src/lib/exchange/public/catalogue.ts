// Catalogue filtering and sorting for SOB Auto Exchange. Pure functions so
// the same rules run on the server (page render) and in tests. Filters live
// in the query string; options are computed from live stock and hide values
// that would return nothing.

import type { ListingCondition, SaleVehicle } from "@/types/domain";

export const sortOptions = [
  { value: "newest", label: "Newest listed" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "mileage_asc", label: "Lowest mileage" },
] as const;

export type CatalogueSort = (typeof sortOptions)[number]["value"];

export type CatalogueFilters = {
  make?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  maxMileage?: number;
  minYear?: number;
  fuel?: string;
  transmission?: string;
  condition?: ListingCondition;
  sort: CatalogueSort;
};

export type FilterKey = Exclude<keyof CatalogueFilters, "sort">;

export const filterKeys: FilterKey[] = ["make", "model", "minPrice", "maxPrice", "maxMileage", "minYear", "fuel", "transmission", "condition"];

type CatalogueVehicle = Pick<SaleVehicle, "make" | "model" | "price" | "mileage" | "year" | "fuelType" | "transmission" | "listingCondition" | "listedAt" | "createdAt" | "status">;

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: RawParams, key: string) {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = typeof single === "string" ? single.trim().slice(0, 60) : "";
  return trimmed || undefined;
}

function readNumber(params: RawParams, key: string, min: number, max: number) {
  const raw = read(params, key);
  if (!raw || !/^\d{1,7}$/.test(raw)) return undefined;
  const value = Number(raw);
  return value >= min && value <= max ? value : undefined;
}

/** Parse and sanitise filters from a query string. Unknown or malformed values are dropped. */
export function parseCatalogueFilters(params: RawParams): CatalogueFilters {
  const condition = read(params, "condition");
  const sort = read(params, "sort");
  return {
    make: read(params, "make"),
    model: read(params, "model"),
    minPrice: readNumber(params, "minPrice", 0, 1_000_000),
    maxPrice: readNumber(params, "maxPrice", 0, 1_000_000),
    maxMileage: readNumber(params, "maxMileage", 0, 2_000_000),
    minYear: readNumber(params, "minYear", 1900, 2100),
    fuel: read(params, "fuel"),
    transmission: read(params, "transmission"),
    condition: condition === "ready_to_drive" || condition === "repair_project" ? condition : undefined,
    sort: sortOptions.some((option) => option.value === sort) ? (sort as CatalogueSort) : "newest",
  };
}

/** Serialise filters back to a query string, omitting empty values and the default sort. */
export function catalogueQueryString(filters: Partial<CatalogueFilters>) {
  const params = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function activeFilterCount(filters: CatalogueFilters) {
  return filterKeys.filter((key) => filters[key] !== undefined && filters[key] !== "").length;
}

function same(a: string, b: string) {
  return a.localeCompare(b, "en-GB", { sensitivity: "accent" }) === 0;
}

function matches(vehicle: CatalogueVehicle, filters: Partial<CatalogueFilters>, skip?: FilterKey) {
  if (skip !== "make" && filters.make && !same(vehicle.make, filters.make)) return false;
  if (skip !== "model" && filters.model && !same(vehicle.model, filters.model)) return false;
  if (skip !== "minPrice" && filters.minPrice !== undefined && vehicle.price < filters.minPrice) return false;
  if (skip !== "maxPrice" && filters.maxPrice !== undefined && vehicle.price > filters.maxPrice) return false;
  if (skip !== "maxMileage" && filters.maxMileage !== undefined && vehicle.mileage > filters.maxMileage) return false;
  if (skip !== "minYear" && filters.minYear !== undefined && vehicle.year < filters.minYear) return false;
  if (skip !== "fuel" && filters.fuel && !same(vehicle.fuelType, filters.fuel)) return false;
  if (skip !== "transmission" && filters.transmission && !same(vehicle.transmission, filters.transmission)) return false;
  if (skip !== "condition" && filters.condition && vehicle.listingCondition !== filters.condition) return false;
  return true;
}

function listedTime(vehicle: CatalogueVehicle) {
  const time = new Date(vehicle.listedAt || vehicle.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function sortVehicles<T extends CatalogueVehicle>(vehicles: T[], sort: CatalogueSort): T[] {
  const sorted = [...vehicles];
  sorted.sort((a, b) => {
    // Available cars before reserved ones; ties fall through to the chosen order.
    const status = Number(a.status === "reserved") - Number(b.status === "reserved");
    if (status !== 0) return status;
    switch (sort) {
      case "price_asc": return a.price - b.price || listedTime(b) - listedTime(a);
      case "price_desc": return b.price - a.price || listedTime(b) - listedTime(a);
      case "mileage_asc": return a.mileage - b.mileage || listedTime(b) - listedTime(a);
      default: return listedTime(b) - listedTime(a);
    }
  });
  return sorted;
}

export function filterVehicles<T extends CatalogueVehicle>(vehicles: T[], filters: CatalogueFilters): T[] {
  return sortVehicles(vehicles.filter((vehicle) => matches(vehicle, filters)), filters.sort);
}

export type FilterOption = { value: string; label: string; count: number };

export type CatalogueFilterOptions = {
  make: FilterOption[];
  model: FilterOption[];
  fuel: FilterOption[];
  transmission: FilterOption[];
  condition: FilterOption[];
  minPrice: FilterOption[];
  maxPrice: FilterOption[];
  maxMileage: FilterOption[];
  minYear: FilterOption[];
};

function countBy<T extends CatalogueVehicle>(vehicles: T[], value: (vehicle: T) => string) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const vehicle of vehicles) {
    const label = value(vehicle).trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase("en-GB");
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label, "en-GB")).map(({ label, count }) => ({ value: label, label, count }));
}

const priceSteps = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12500, 15000, 17500, 20000, 25000, 30000, 40000, 50000, 75000, 100000];
const mileageSteps = [10000, 20000, 30000, 40000, 50000, 60000, 80000, 100000, 125000, 150000];

/**
 * Threshold options ("from £5,000", "up to 60,000 miles"). An option is shown
 * only when it changes the results: never zero matches, never every match,
 * and never the same count as a neighbouring threshold. The selected value is
 * always kept so the control can show it.
 */
function thresholdOptions<T>(pool: T[], steps: number[], test: (vehicle: T, step: number) => boolean, label: (step: number) => string, selected?: number): FilterOption[] {
  const options: FilterOption[] = [];
  const seen = new Set<number>();
  for (const step of steps) {
    const count = pool.filter((vehicle) => test(vehicle, step)).length;
    const isSelected = step === selected;
    if (!isSelected && (count === 0 || count === pool.length || seen.has(count))) continue;
    seen.add(count);
    options.push({ value: String(step), label: label(step), count });
  }
  return options;
}

/**
 * Facet options for the filter panel. Each facet is computed from stock that
 * matches every *other* active filter, so options that would return nothing
 * are hidden and the counts are what the visitor would actually get.
 */
export function buildFilterOptions<T extends CatalogueVehicle>(vehicles: T[], filters: CatalogueFilters): CatalogueFilterOptions {
  const facet = (key: FilterKey) => vehicles.filter((vehicle) => matches(vehicle, filters, key));
  const pounds = (step: number) => `£${step.toLocaleString("en-GB")}`;
  const years = [...new Set(facet("minYear").map((vehicle) => vehicle.year))].sort((a, b) => b - a);
  return {
    make: countBy(facet("make"), (vehicle) => vehicle.make),
    // Models only make sense once a make is chosen.
    model: filters.make ? countBy(facet("model"), (vehicle) => vehicle.model) : [],
    fuel: countBy(facet("fuel"), (vehicle) => vehicle.fuelType),
    transmission: countBy(facet("transmission"), (vehicle) => vehicle.transmission),
    condition: (["ready_to_drive", "repair_project"] as const)
      .map((value) => ({ value, label: value === "ready_to_drive" ? "Ready to drive" : "Repair project", count: facet("condition").filter((vehicle) => vehicle.listingCondition === value).length }))
      .filter((option) => option.count > 0),
    minPrice: thresholdOptions(facet("minPrice"), [...priceSteps].reverse(), (vehicle, step) => vehicle.price >= step, (step) => `From ${pounds(step)}`, filters.minPrice).reverse(),
    maxPrice: thresholdOptions(facet("maxPrice"), priceSteps, (vehicle, step) => vehicle.price <= step, (step) => `Up to ${pounds(step)}`, filters.maxPrice),
    maxMileage: thresholdOptions(facet("maxMileage"), mileageSteps, (vehicle, step) => vehicle.mileage <= step, (step) => `Up to ${step.toLocaleString("en-GB")} miles`, filters.maxMileage),
    minYear: thresholdOptions(facet("minYear"), years, (vehicle, year) => vehicle.year >= year, (year) => `${year} or newer`, filters.minYear).sort((a, b) => Number(b.value) - Number(a.value)),
  };
}

/** Human-readable chips for the active filters, each with the query string that removes it. */
export function activeFilterChips(filters: CatalogueFilters) {
  const chips: Array<{ key: FilterKey; label: string; query: string }> = [];
  const label: Record<FilterKey, (value: string) => string> = {
    make: (value) => value,
    model: (value) => value,
    minPrice: (value) => `From £${Number(value).toLocaleString("en-GB")}`,
    maxPrice: (value) => `Up to £${Number(value).toLocaleString("en-GB")}`,
    maxMileage: (value) => `Up to ${Number(value).toLocaleString("en-GB")} miles`,
    minYear: (value) => `${value} or newer`,
    fuel: (value) => value,
    transmission: (value) => value,
    condition: (value) => (value === "repair_project" ? "Repair projects" : "Ready to drive"),
  };
  for (const key of filterKeys) {
    const value = filters[key];
    if (value === undefined || value === "") continue;
    const next: Partial<CatalogueFilters> = { ...filters, [key]: undefined };
    if (key === "make") next.model = undefined;
    chips.push({ key, label: label[key](String(value)), query: catalogueQueryString(next) });
  }
  return chips;
}
