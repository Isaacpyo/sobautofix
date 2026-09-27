import { describe, expect, it } from "vitest";
import { serviceCatalogue, serviceCatalogueNames } from "@/config/service-catalogue";
import { invoiceServiceOptions } from "@/lib/invoices/service-options";

describe("invoice service options", () => {
  it("uses the shared public catalogue without duplicates", () => {
    expect(invoiceServiceOptions).toEqual(expect.arrayContaining([
      "Vehicle Diagnostic Assessment",
      "Cooling System Diagnosis",
      "Brake System Diagnosis",
      "Pre-Purchase Vehicle Inspection",
      "Service & Maintenance",
    ]));
    expect(new Set(invoiceServiceOptions.map((name) => name.toLowerCase())).size).toBe(invoiceServiceOptions.length);
    expect(invoiceServiceOptions).toEqual(serviceCatalogueNames);
    expect(serviceCatalogue).toHaveLength(13);
  });
});
