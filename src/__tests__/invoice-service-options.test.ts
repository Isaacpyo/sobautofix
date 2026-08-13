import { describe, expect, it } from "vitest";
import { diagnostics, services } from "@/config/site";
import { invoiceServiceOptions } from "@/lib/invoices/service-options";

describe("invoice service options", () => {
  it("combines booking and published SOB Autofix services without duplicates", () => {
    expect(invoiceServiceOptions).toEqual(expect.arrayContaining([
      "Vehicle Diagnostics",
      "Vehicle Servicing",
      "Engine Repair Assessment",
      "Mobile Diagnostic Visit",
      "Pre-Purchase Inspection",
      "ECU Diagnostics",
      "DPF Diagnostics",
    ]));
    expect(new Set(invoiceServiceOptions.map((name) => name.toLowerCase())).size).toBe(invoiceServiceOptions.length);

    const publishedFrontendServices = [...services, ...diagnostics].filter((service) => service.published).map((service) => service.name);
    expect(invoiceServiceOptions).toEqual(expect.arrayContaining(publishedFrontendServices));
  });
});
