import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentEntrySchema } from "@/lib/content/schema";
import { calculateReadingMinutes, parseArticleMetadata } from "@/lib/news/article";

const read = (path: string) => readFileSync(path, "utf8");

describe("News & Blog publishing", () => {
  it("normalises article metadata and calculates reading time", () => {
    expect(parseArticleMetadata({ category: "Diagnostics", author: "  Jane Doe  ", featured: true })).toEqual({
      category: "Diagnostics",
      author: "Jane Doe",
      coverImageId: undefined,
      featured: true,
    });
    expect(parseArticleMetadata({}).category).toBe("Advice & Guides");
    expect(calculateReadingMinutes([{ type: "richText", paragraphs: [Array(201).fill("word").join(" ")] }])).toBe(2);
  });

  it("accepts a valid article draft through the shared content schema", () => {
    const result = contentEntrySchema.safeParse({
      kind: "article",
      slug: "diagnostic-guide",
      title: "A diagnostic guide",
      excerpt: "A practical guide to understanding diagnostic work.",
      sections: [{ type: "richText", heading: "Start here", paragraphs: ["Useful customer-facing guidance."] }],
      metadata: { category: "Diagnostics", author: "SOB Autofix Team" },
      seoTitle: "Vehicle diagnostic guide",
      seoDescription: "A practical vehicle diagnostic guide from the SOB Autofix team in Doncaster.",
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("keeps unpublished articles out of public repository reads", () => {
    const repository = read("src/lib/news/repository.ts");
    expect(repository).toContain('.eq("kind", "article")');
    expect(repository).toContain('.eq("status", "published")');
  });

  it("uses /news as the canonical route everywhere", () => {
    expect(read("src/app/sitemap.ts")).toContain('entry.kind === "article" ? "news"');
    expect(read("src/app/api/cron/publish/route.ts")).toContain('return `/news/${slug}`');
    expect(read("src/app/advice/page.tsx")).toContain('permanentRedirect("/news")');
  });

  it("checks cover publication and alt text before article publication", () => {
    const actions = read("src/app/admin/(protected)/actions.ts");
    expect(actions).toContain("Publish the selected cover image");
    expect(actions).toContain("meaningful alt text");
    expect(actions).toContain('parsed.kind === "article" ? "article" : "content"');
  });

  it("keeps revision and audit failures from passing silently", () => {
    const actions = read("src/app/admin/(protected)/actions.ts");
    expect(actions).toContain("required audit entry could not be recorded");
    expect(actions).toContain("current revision could not be preserved");
    expect(actions).toContain("revalidateContent(current.kind, current.slug)");
  });

  it("applies prohibited-content safeguards to article publishing input", () => {
    const result = contentEntrySchema.safeParse({
      kind: "article",
      slug: "unsafe-service-advert",
      title: "Unsafe service advert",
      excerpt: "Book an MOT appointment directly with the workshop.",
      sections: [{ type: "richText", paragraphs: ["Customer-facing promotional copy."] }],
      metadata: { category: "Company News", author: "SOB Autofix Team" },
      seoTitle: "Unsafe service advertising article",
      seoDescription: "A deliberately prohibited customer-facing article used only for validation.",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });
});
