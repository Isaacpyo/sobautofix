import { describe, expect, it } from "vitest";
import { createMetadata, serviceJsonLd } from "@/lib/seo";
import { servicePriceLabel } from "@/lib/pricing/policy";

describe("SEO and approved pricing", () => {
  it("creates an absolute canonical and matching Open Graph URL", () => {
    const metadata = createMetadata("Vehicle Diagnostics", "A sufficiently detailed diagnostic service description.", "/diagnostics/car-diagnostics");
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/diagnostics/car-diagnostics");
    expect(metadata.openGraph && "url" in metadata.openGraph ? metadata.openGraph.url : undefined).toBe("http://localhost:3000/diagnostics/car-diagnostics");
  });

  it("creates Service structured data with a provider and service URL", () => {
    const data = serviceJsonLd("Vehicle Diagnostics", "Professional diagnostic testing.", "/diagnostics/car-diagnostics");
    expect(data["@type"]).toBe("Service");
    expect(data.provider.name).toBe("SOB Autofix");
    expect(data.url).toContain("/diagnostics/car-diagnostics");
  });

  it("formats only explicit approved price values", () => {
    expect(servicePriceLabel({ minimum: 80 })).toBe("From £80");
    expect(servicePriceLabel({ minimum: 80, maximum: 120 })).toBe("£80–£120");
    expect(servicePriceLabel({ label: "Inspection price on request" })).toBe("Inspection price on request");
    expect(servicePriceLabel({ notes: "Depends on scope" })).toBeUndefined();
  });
});
