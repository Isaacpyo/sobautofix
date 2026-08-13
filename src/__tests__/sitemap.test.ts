import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSitemap } from "@/app/sitemap";
import type { ContentEntry, SaleVehicle } from "@/types/domain";

const content = (overrides: Partial<ContentEntry> = {}): ContentEntry => ({
  id: "00000000-0000-0000-0000-000000000001",
  kind: "article",
  slug: "diagnostic-guide",
  title: "Diagnostic guide",
  excerpt: "A useful diagnostic guide.",
  sections: [],
  metadata: {},
  seoTitle: "Diagnostic guide in Doncaster",
  seoDescription: "A useful diagnostic guide for drivers in Doncaster.",
  status: "published",
  updatedAt: "2026-08-10T12:00:00.000Z",
  ...overrides,
});

const vehicle = (overrides: Partial<SaleVehicle> = {}): SaleVehicle => ({
  id: "00000000-0000-0000-0000-000000000002",
  slug: "ford-focus-2020",
  make: "Ford",
  model: "Focus",
  year: 2020,
  mileage: 40_000,
  price: 9_000,
  fuelType: "Diesel",
  transmission: "Manual",
  description: "A genuine vehicle listing.",
  features: [],
  images: [],
  status: "available",
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-08-09T15:30:00.000Z",
  ...overrides,
});

const build = (overrides: Partial<Parameters<typeof buildSitemap>[0]> = {}) => buildSitemap({
  baseUrl: "https://sobautofix.com",
  content: [],
  vehicles: [],
  hasReviews: false,
  hasMedia: false,
  ...overrides,
});

describe("sitemap generation", () => {
  it("emits unique canonical URLs and lets CMS dates replace seeded-route metadata", () => {
    const entries = build({ content: [content({ kind: "service", slug: "vehicle-servicing" })] });
    const urls = entries.map((entry) => entry.url);
    const service = entries.filter((entry) => entry.url === "https://sobautofix.com/services/vehicle-servicing");

    expect(new Set(urls).size).toBe(urls.length);
    expect(service).toHaveLength(1);
    expect(service[0]?.lastModified).toEqual(new Date("2026-08-10T12:00:00.000Z"));
  });

  it("does not fabricate modification dates and uses the vehicle update timestamp", () => {
    const entries = build({ vehicles: [vehicle()] });

    expect(entries.find((entry) => entry.url === "https://sobautofix.com/about")?.lastModified).toBeUndefined();
    expect(entries.find((entry) => entry.url.endsWith("/cars-for-sale/ford-focus-2020"))?.lastModified)
      .toEqual(new Date("2026-08-09T15:30:00.000Z"));
  });

  it("includes conditional and custom CMS pages only when their public data exists", () => {
    const entries = build({ hasReviews: true, hasMedia: true, content: [content({ kind: "core_page", slug: "new-public-page" })] });
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://sobautofix.com/reviews");
    expect(urls).toContain("https://sobautofix.com/gallery");
    expect(urls).toContain("https://sobautofix.com/new-public-page");
  });

  it("rejects unsafe origins and invalid database timestamps", () => {
    expect(() => build({ baseUrl: "https://sobautofix.com/subdirectory" })).toThrow(/HTTP\(S\) origin/);
    expect(() => build({ content: [content({ updatedAt: "not-a-date" })] })).toThrow(/Invalid sitemap last-modified date/);
  });

  it("revalidates the sitemap when review or gallery indexability changes", () => {
    const actions = readFileSync("src/app/admin/(protected)/actions.ts", "utf8");
    const mediaAction = actions.slice(actions.indexOf("export async function toggleMediaPublication"), actions.indexOf("export async function syncGoogleReviews"));
    const reviewAction = actions.slice(actions.indexOf("export async function toggleReview"), actions.indexOf("export async function saveSettings"));

    expect(mediaAction).toContain('revalidatePath("/sitemap.xml")');
    expect(reviewAction).toContain('revalidatePath("/sitemap.xml")');
  });
});
