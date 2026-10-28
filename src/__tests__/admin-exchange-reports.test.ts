import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildReportRows, reportCsv, reportPeriod, summariseRows, type VehicleInput } from "@/lib/exchange/admin/reports";
import { reencodePhoto } from "@/lib/exchange/admin/uploads";
import { breakdownCosts, recordedGrossMargin, REPORT_DEFINITIONS } from "@/lib/exchange/margin";

const now = new Date("2026-10-28T12:00:00Z");
const vehicles: VehicleInput[] = [
  { id: "v1", stock_reference: "STK-00001", make: "Ford", model: "Focus", year: 2019, status: "sold", price: 9495, created_at: "2026-09-01T09:00:00Z", listed_at: "2026-09-05T09:00:00Z", sold_at: "2026-10-20T09:00:00Z" },
  { id: "v2", stock_reference: "=HYPERLINK(\"x\")", make: "Vauxhall", model: "Astra", year: 2017, status: "available", price: 6750, created_at: "2026-10-01T09:00:00Z", listed_at: null, sold_at: null },
];
const costs = [
  { saleVehicleId: "v1", category: "purchase" as const, amountPence: 690000, basis: "actual" as const },
  { saleVehicleId: "v1", category: "transport" as const, amountPence: 5000, basis: "actual" as const },
  { saleVehicleId: "v1", category: "parts" as const, amountPence: 21800, basis: "actual" as const },
  { saleVehicleId: "v1", category: "valeting" as const, amountPence: 6000, basis: "actual" as const },
  { saleVehicleId: "v1", category: "fees" as const, amountPence: 1250, basis: "actual" as const },
  { saleVehicleId: "v2", category: "purchase" as const, amountPence: 400000, basis: "actual" as const },
  { saleVehicleId: "v2", category: "repair" as const, amountPence: 20000, basis: "estimated" as const },
];

describe("cost breakdown and recorded gross margin", () => {
  it("groups cost lines exactly as the definitions say", () => {
    expect(breakdownCosts(costs.filter((cost) => cost.saleVehicleId === "v1"))).toEqual({ acquisitionPence: 690000, transportPence: 5000, preparationRepairPence: 27800, otherDirectPence: 1250, totalPence: 724050, allActual: true });
  });

  it("uses the completed sale price, else the advertised price as an estimate", () => {
    const sold = recordedGrossMargin({ costs: costs.filter((cost) => cost.saleVehicleId === "v1"), advertisedPricePounds: 9495, completedSalePence: 925000 });
    expect(sold).toMatchObject({ salePricePence: 925000, salePriceBasis: "actual", grossMarginPence: 925000 - 724050, basis: "actual" });
    const unsold = recordedGrossMargin({ costs: costs.filter((cost) => cost.saleVehicleId === "v2"), advertisedPricePounds: 6750 });
    expect(unsold).toMatchObject({ salePricePence: 675000, salePriceBasis: "estimated", grossMarginPence: 675000 - 420000, basis: "estimated" });
    for (const value of [sold.grossMarginPence, unsold.grossMarginPence, sold.totalPence]) expect(Number.isInteger(value)).toBe(true);
  });

  it("never calls the figure profit except to say it is not", () => {
    const text = JSON.stringify(REPORT_DEFINITIONS);
    expect(text).toMatch(/Recorded gross margin/);
    expect(text.match(/profit/gi)).toEqual(["profit"]);
    expect(text).toMatch(/not net profit/);
  });
});

describe("report rows, totals and CSV", () => {
  const rows = buildReportRows({ vehicles, costs, acquiredOn: new Map([["v1", "2026-08-30"]]), completedSales: new Map([["v1", 925000]]) }, now);

  it("works out days in stock from acquisition, listing or creation to sale or today", () => {
    expect(rows[0]).toMatchObject({ vehicleId: "v1", daysInStock: 51, salePriceBasis: "actual", marginBasis: "actual" });
    expect(rows[1]).toMatchObject({ vehicleId: "v2", daysInStock: 27, salePriceBasis: "estimated", marginBasis: "estimated" });
  });

  it("totals only sales completed in the period", () => {
    const summary = summariseRows(rows, reportPeriod("30", now));
    expect(summary).toMatchObject({ soldCount: 1, salesPence: 925000, costsPence: 724050, grossMarginPence: 200950, averageDaysInStock: 51, inStockCount: 1 });
    expect(summariseRows(rows, { key: "x", label: "x", from: "2026-01-01", to: "2026-02-01" }).soldCount).toBe(0);
  });

  it("exports vehicle and money columns only, with formulas neutralised", () => {
    const csv = reportCsv(rows);
    const [header, ...lines] = csv.trim().split("\r\n");
    expect(header).not.toMatch(/name|email|phone|registration|postcode|customer/i);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("STK-00001,2019 Ford Focus,Sold,2026-08-30");
    expect(lines[0]).toContain("6900.00,50.00,278.00,12.50,7240.50,9250.00,Actual,2009.50,Actual");
    expect(lines[1]!.startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });
});

describe("photo re-encoding", () => {
  it("removes EXIF and location metadata and applies the orientation", async () => {
    const original = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#d33" } })
      .withMetadata({ orientation: 6, exif: { IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 31/1 0/1" } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const encoded = await reencodePhoto(new Uint8Array(original), "image/jpeg");
    const metadata = await sharp(Buffer.from(encoded)).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("jpeg");
    expect([metadata.width, metadata.height]).toEqual([20, 40]);
  });
});
