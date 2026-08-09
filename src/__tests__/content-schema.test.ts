import { describe, expect, it } from "vitest";
import { contentEntrySchema } from "@/lib/content/schema";

const base = {
  kind: "service" as const,
  slug: "approved-service",
  title: "Approved diagnostic service",
  excerpt: "A sufficiently detailed and useful service summary.",
  sections: [{ type: "hero" as const, title: "Evidence-led service", body: "A clear description of the approved service." }],
  metadata: {},
  seoTitle: "Approved diagnostic service in Doncaster",
  seoDescription: "Professional diagnostic service information with clear customer expectations in Doncaster.",
  status: "draft" as const,
};

describe("CMS content schema", () => {
  it("accepts valid structured content", () => expect(contentEntrySchema.safeParse(base).success).toBe(true));
  it("requires clean slugs and useful SEO fields", () => expect(contentEntrySchema.safeParse({ ...base, slug: "Bad Slug", seoDescription: "short" }).success).toBe(false));
  it("rejects raw HTML-shaped section data", () => expect(contentEntrySchema.safeParse({ ...base, sections: [{ type: "richText", paragraphs: [] }] }).success).toBe(false));
});
