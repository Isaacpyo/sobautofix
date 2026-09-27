import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("service breadcrumbs", () => {
  it("prefixes service routes with the Services hierarchy", () => {
    const index = read("src", "app", "services", "page.tsx");
    const repairs = read("src", "app", "services", "repairs-maintenance", "page.tsx");
    const mobile = read("src", "app", "services", "mobile-specialist", "page.tsx");
    const detail = read("src", "app", "services", "[slug]", "page.tsx");

    for (const page of [index, repairs, mobile, detail]) {
      expect(page).toContain('label: "Services", href: "/services"');
    }
    expect(repairs).toContain('label: "Repairs & Maintenance", href: "/services/repairs-maintenance"');
    expect(mobile).toContain('label: "Mobile & Specialist", href: "/services/mobile-specialist"');
    expect(detail).toContain('{ label: item.name, href: `/services/${slug}` }');
  });
});
