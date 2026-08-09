import { describe, expect, it } from "vitest";
import { diagnostics, services } from "@/config/site";

describe("service publication configuration", () => {
  it("keeps specialist clutch work marked as outsourced", () => {
    expect(services.find((service) => service.slug === "clutch-replacement")?.deliveryType).toBe("outsourced_specialist");
  });

  it("publishes only the approved priority repair and diagnostic pages", () => {
    expect(services.filter((service) => service.published).map((service) => service.slug)).toEqual(["vehicle-servicing", "engine-repair", "brake-repair"]);
    expect(diagnostics.filter((service) => service.published)).toHaveLength(7);
  });
});
