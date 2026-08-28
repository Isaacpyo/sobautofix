import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin shell", () => {
  it("keeps the CMS header available while admin pages scroll", () => {
    const source = readFileSync(join(process.cwd(), "src/components/admin/admin-shell.tsx"), "utf8");
    expect(source).toContain('<header className="sticky top-0 z-30');
    expect(source).toContain("SOB Autofix CMS");
    expect(source).toContain("Search admin sections");
    expect(source).toContain('href="/"');
  });
});
