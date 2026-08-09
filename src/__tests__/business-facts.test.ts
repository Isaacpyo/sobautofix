import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { localBusinessJsonLd } from "@/lib/seo";

const publicMarketingFiles = [
  "src/app/page.tsx",
  "src/app/areas/page.tsx",
  "src/app/areas/doncaster/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/faqs/page.tsx",
  "src/components/layout/footer.tsx",
  "src/components/marketing/trust-bar.tsx",
  "src/config/landing-content.ts",
];

describe("approved business facts", () => {
  it("does not publish unconfirmed opening hours", () => {
    expect(Object.values(siteConfig.openingHours).every((hours) => hours === "")).toBe(true);
    expect(localBusinessJsonLd()).not.toHaveProperty("openingHours");
    for (const file of publicMarketingFiles) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toMatch(/open 24 hours|24 hours, seven days/i);
    }
  });

  it("keeps phone and WhatsApp distinct", () => {
    expect(siteConfig.phone).toBe("07469273483");
    expect(siteConfig.whatsapp).toBe("07468273483");
    expect(siteConfig.phone).not.toBe(siteConfig.whatsapp);
  });

  it("markets Doncaster and South Yorkshire instead of Norton", () => {
    for (const file of publicMarketingFiles) {
      const content = readFileSync(join(process.cwd(), file), "utf8");
      expect(content).not.toMatch(/Norton/i);
    }
  });
});
