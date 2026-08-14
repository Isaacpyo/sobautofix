import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("service category hub architecture", () => {
  it("uses one canonical route for each category without a duplicate diagnostics hub", () => {
    expect(existsSync(join(root, "src/app/diagnostics/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/services/repairs-maintenance/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/services/mobile-specialist/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/services/diagnostics"))).toBe(false);
  });

  it("links all category headings to their canonical hubs", () => {
    const header = read("src/components/layout/header.tsx");
    expect(header).toContain('title: "Diagnostics",\n    href: "/diagnostics"');
    expect(header).toContain('title: "Repairs & Maintenance",\n    href: "/services/repairs-maintenance"');
    expect(header).toContain('title: "Mobile & Specialist",\n    href: "/services/mobile-specialist"');
  });

  it("includes all category routes in the sitemap source", () => {
    const sitemap = read("src/app/sitemap.ts");
    for (const route of ["/diagnostics", "/services/repairs-maintenance", "/services/mobile-specialist"]) expect(sitemap).toContain(`"${route}"`);
  });

  it("links footer category headings to the master hubs", () => {
    const footer = read("src/components/layout/footer.tsx");
    expect(footer).toContain('title="Diagnostics" titleHref="/diagnostics"');
    expect(footer).toContain('titleHref="/services"');
  });

  it("keeps the expected individual-service links on each hub", () => {
    const diagnostics = read("src/app/diagnostics/page.tsx");
    const diagnosticCarousel = read("src/components/diagnostics/diagnostic-service-carousel.tsx");
    const repairs = read("src/app/services/repairs-maintenance/page.tsx");
    const mobile = read("src/app/services/mobile-specialist/page.tsx");
    const serviceConfig = read("src/config/site.ts");
    expect(diagnostics).toContain("<DiagnosticServiceCarousel items={publishedDiagnostics} />");
    expect(diagnosticCarousel).toContain("items.map");
    expect(diagnosticCarousel).toContain('href={`/diagnostics/${item.slug}`}');
    expect(repairs).toContain("coreServices.map");
    for (const slug of ["vehicle-servicing", "engine-repair", "brake-repair"]) expect(serviceConfig).toContain(`slug: "${slug}"`);
    for (const route of ["/mobile-mechanic", "/vehicle-recovery", "/vehicle-inspections", "/fleet"]) expect(mobile).toContain(route);
  });
});
