import { describe, expect, it } from "vitest";
import { exchangePublicDefaults } from "@/config/exchange";
import { exchangeHref, isExchangeHostname, isSharedInfrastructurePath, toExchangePublicPath } from "@/lib/exchange/host";
import { daysInStock, summariseMargin } from "@/lib/exchange/margin";
import { can, permissionsFor } from "@/lib/exchange/permissions";
import { canTransition, getPublishReadiness } from "@/lib/exchange/readiness";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { mergeSettings } from "@/lib/exchange/settings";

const listing = {
  make: "Ford", model: "Focus", year: 2018, mileage: 52_000, price: 7995, fuelType: "Petrol", transmission: "Manual",
  description: "One owner from new with a documented service record.",
  images: [1, 2, 3, 4].map((position) => ({ id: String(position), url: "https://example.test/photo.jpg", alt: "Photo", position })),
  conditionSummary: "Light marks on the rear bumper; interior clean and complete.",
  listingCondition: "ready_to_drive" as const, writeOffStatus: "not_confirmed" as const, knownFaults: [],
};

describe("staff permissions", () => {
  it("restricts finance and settings to the right roles", () => {
    expect(can("owner", "settings.manage")).toBe(true);
    expect(can("manager", "settings.manage")).toBe(false);
    expect(can("manager", "finance.view")).toBe(true);
    expect(can("sales", "finance.view")).toBe(false);
    expect(can("sales", "stock.price")).toBe(false);
    expect(can("sales", "stock.publish")).toBe(false);
    expect(can("workshop", "customers.view")).toBe(false);
    expect(can("workshop", "prep.manage")).toBe(true);
  });

  it("gives every role access to the section and the diary", () => {
    for (const role of ["owner", "manager", "sales", "workshop"] as const) {
      expect(permissionsFor(role)).toEqual(expect.arrayContaining(["exchange.view", "diary.manage"]));
    }
  });
});

describe("publish readiness", () => {
  it("accepts a complete listing", () => {
    expect(getPublishReadiness(listing, { minimumPhotos: 4 })).toMatchObject({ ready: true, missing: [] });
  });

  it("blocks missing photos, price and condition disclosure", () => {
    const result = getPublishReadiness({ ...listing, price: 0, images: [], conditionSummary: "" }, { minimumPhotos: 4 });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(["An advertised price above £0", "At least 4 photographs", "A condition summary of at least 20 characters"]));
  });

  it("requires listed faults for a repair project", () => {
    expect(getPublishReadiness({ ...listing, listingCondition: "repair_project" }, { minimumPhotos: 4 }).ready).toBe(false);
    expect(getPublishReadiness({ ...listing, listingCondition: "repair_project", knownFaults: ["Gearbox noise in third"] }, { minimumPhotos: 4 }).ready).toBe(true);
  });

  it("follows the stock workflow", () => {
    expect(canTransition("draft", "preparation")).toBe(true);
    expect(canTransition("preparation", "available")).toBe(true);
    expect(canTransition("available", "reserved")).toBe(true);
    expect(canTransition("draft", "sold")).toBe(false);
    expect(canTransition("archived", "available")).toBe(true);
  });
});

describe("gross margin", () => {
  it("subtracts purchase and direct costs from the advertised price and stays estimated before sale", () => {
    const summary = summariseMargin({
      advertisedPricePounds: 8000,
      costs: [
        { category: "purchase", amountPence: 500_000, basis: "actual" },
        { category: "repair", amountPence: 45_000, basis: "estimated" },
        { category: "valeting", amountPence: 5_000, basis: "actual" },
      ],
    });
    expect(summary).toMatchObject({ purchasePence: 500_000, directCostsPence: 50_000, totalCostPence: 550_000, sellingPricePence: 800_000, grossMarginPence: 250_000, sellingPriceSource: "advertised", basis: "estimated", marginPercent: 31.3 });
  });

  it("is actual only for a completed sale with actual costs", () => {
    const costs = [{ category: "purchase" as const, amountPence: 400_000, basis: "actual" as const }];
    expect(summariseMargin({ advertisedPricePounds: 6000, costs, sale: { agreedPricePence: 575_000, completed: true } })).toMatchObject({ basis: "actual", grossMarginPence: 175_000, sellingPriceSource: "completed_sale" });
    expect(summariseMargin({ advertisedPricePounds: 6000, costs, sale: { agreedPricePence: 575_000, completed: false } }).basis).toBe("estimated");
  });

  it("counts days in stock from acquisition to sale", () => {
    expect(daysInStock({ acquiredOn: "2026-10-01", createdAt: "2026-10-05T00:00:00Z", soldAt: "2026-10-21T00:00:00Z" })).toBe(20);
    expect(daysInStock({ createdAt: "2026-10-01T00:00:00Z" }, new Date("2026-10-11T00:00:00Z"))).toBe(10);
  });
});

describe("exchange host routing", () => {
  it("recognises the exchange host", () => {
    expect(isExchangeHostname("exchange.sobautofix.com", undefined)).toBe(true);
    expect(isExchangeHostname("exchange.localhost:3000", undefined)).toBe(true);
    expect(isExchangeHostname("cars.example.com", "https://cars.example.com")).toBe(true);
    expect(isExchangeHostname("sobautofix.com", undefined)).toBe(false);
  });

  it("builds links for both hosting modes", () => {
    expect(exchangeHref("", "/cars")).toBe("/cars");
    expect(exchangeHref("/exchange", "/cars")).toBe("/exchange/cars");
    expect(exchangeHref("/exchange", "/")).toBe("/exchange");
    expect(toExchangePublicPath("/exchange/cars/ford-focus")).toBe("/cars/ford-focus");
    expect(toExchangePublicPath("/exchange")).toBe("/");
  });

  it("leaves shared infrastructure alone on the exchange host", () => {
    expect(isSharedInfrastructurePath("/api/exchange/viewings")).toBe(true);
    expect(isSharedInfrastructurePath("/_next/static/chunk.js")).toBe(true);
    expect(isSharedInfrastructurePath("/cars")).toBe(false);
  });
});

describe("exchange settings", () => {
  it("keeps defaults and ignores unknown or mistyped overrides", () => {
    const merged = mergeSettings(exchangePublicDefaults, { name: "SOB Motors", tagline: 42, unknown: "x", policies: { complaints: "Write to us." } });
    expect(merged.name).toBe("SOB Motors");
    expect(merged.tagline).toBe(exchangePublicDefaults.tagline);
    expect(merged.policies.complaints).toBe("Write to us.");
    expect(merged.policies.vehicleSalesTerms).toBe("");
    expect("unknown" in merged).toBe(false);
  });

  it("detects a database without the exchange migration", () => {
    expect(isMissingSchemaError({ code: "PGRST205" })).toBe(true);
    expect(isMissingSchemaError({ code: "42703" })).toBe(true);
    expect(isMissingSchemaError({ code: "23505" })).toBe(false);
  });
});
