import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("inventory lookup privacy and business rules", () => {
  const client = readFileSync("src/components/admin/add-vehicle-flow.tsx", "utf8");
  const route = readFileSync("src/app/api/admin/inventory/lookup/route.ts", "utf8");
  const provider = readFileSync("src/lib/vehicle/vehicle-data-global.ts", "utf8");

  it("keeps registration in the POST body, not the URL or telemetry", () => {
    expect(client).toContain('fetch("/api/admin/inventory/lookup"');
    expect(client).not.toMatch(/searchParams|captureMessage|addBreadcrumb|analytics/);
    expect(route).not.toMatch(/console\.|captureMessage|addBreadcrumb/);
  });

  it("does not normalise or persist prohibited test-history fields", () => {
    const prohibited = ["motStatus", "motExpiry", "motHistory", "motAdvisories"];
    for (const field of prohibited) expect(provider).not.toContain(field);
  });
});
