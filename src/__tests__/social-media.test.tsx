// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialLinks } from "@/components/marketing/social-links";
import { siteConfig, type SocialLinksConfig } from "@/config/site";
import { localBusinessJsonLd } from "@/lib/seo";

const enabledUrls = [
  "https://www.facebook.com/sobautofix",
  "https://www.instagram.com/sobautofix/",
  "https://www.tiktok.com/@sobautofix",
] as const;

describe("public social profiles", () => {
  it("keeps confirmed profiles in the central site configuration", () => {
    expect(Object.values(siteConfig.socials).filter(Boolean)).toEqual(enabledUrls);
    expect(siteConfig.socials.youtube).toBeNull();
    expect(siteConfig.socials.x).toBeNull();
  });

  it("renders enabled profiles with accessible names and safe external-link attributes", () => {
    render(<SocialLinks socials={siteConfig.socials} />);

    for (const [label, url] of [["Facebook", enabledUrls[0]], ["Instagram", enabledUrls[1]], ["TikTok", enabledUrls[2]]]) {
      const link = screen.getByRole("link", { name: `SOB Autofix on ${label}` });
      expect(link).toHaveAttribute("href", url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.queryByRole("link", { name: "SOB Autofix on YouTube" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SOB Autofix on X" })).not.toBeInTheDocument();
  });

  it("does not render unconfigured platforms", () => {
    const socials: SocialLinksConfig = { facebook: null, instagram: enabledUrls[1], tiktok: null, youtube: null, x: null };
    render(<SocialLinks socials={socials} showLabels />);
    expect(screen.getByRole("link", { name: "SOB Autofix on Instagram" })).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(1);
  });

  it("adds the enabled profiles to the existing LocalBusiness schema", () => {
    const schema = localBusinessJsonLd();
    expect(schema["@type"]).toEqual(["AutoRepair", "LocalBusiness"]);
    expect(schema.sameAs).toEqual(enabledUrls);
  });

  it("places the shared social component in the footer and Contact page", () => {
    const footer = readFileSync(join(process.cwd(), "src/components/layout/footer.tsx"), "utf8");
    const contact = readFileSync(join(process.cwd(), "src/app/contact/page.tsx"), "utf8");
    expect(footer).toContain("<SocialLinks socials={settings.socials}");
    expect(contact).toContain("<SocialLinks socials={siteConfig.socials}");
  });

  it("keeps one authoritative LocalBusiness schema invocation", () => {
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home.match(/localBusinessJsonLd\(\)/g)).toHaveLength(1);
  });
});
