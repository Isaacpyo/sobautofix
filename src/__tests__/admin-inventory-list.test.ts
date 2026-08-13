import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin inventory list", () => {
  it("provides a loading View action for every vehicle", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/inventory/page.tsx"), "utf8");
    expect(source).toContain(">View</AdminLoadingLink>");
    expect(source).toContain('loadingTitle="Opening vehicle"');
  });
});
