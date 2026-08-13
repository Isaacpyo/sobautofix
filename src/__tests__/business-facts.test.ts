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

  it("uses the confirmed phone number for phone and WhatsApp", () => {
    expect(siteConfig.phone).toBe("07469273483");
    expect(siteConfig.whatsapp).toBe("07469273483");
    expect(siteConfig.phone).toBe(siteConfig.whatsapp);
  });

  it("uses the public domain address without exposing the destination mailbox", () => {
    expect(siteConfig.email).toBe("info@sobautofix.com");
    expect(localBusinessJsonLd()).toMatchObject({ email: "info@sobautofix.com" });
    for (const file of publicMarketingFiles) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toContain("sobautofix@gmail.com");
    }
  });

  it("uses the approved transparent logo variants", () => {
    const logoComponent = readFileSync(join(process.cwd(), "src/components/layout/logo.tsx"), "utf8");
    const rootLayout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(logoComponent).toContain("assets/sobautofix_logo.png");
    expect(logoComponent).toContain("assets/sobautofix_logo-white.png");
    expect(rootLayout).toContain("assets/sobautofix_siteicon.png");
  });

  it("markets Doncaster and South Yorkshire instead of Norton", () => {
    for (const file of publicMarketingFiles) {
      const content = readFileSync(join(process.cwd(), file), "utf8");
      expect(content).not.toMatch(/Norton/i);
    }
  });
});
