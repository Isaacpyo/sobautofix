import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { articleStructuredData } from "@/app/news/[slug]/page";
import { JsonLd } from "@/components/seo/json-ld";
import type { NewsArticle } from "@/lib/news/article";

const article = (sections: NewsArticle["sections"]): NewsArticle => ({
  id: "00000000-0000-0000-0000-000000000001",
  kind: "article",
  slug: "engine-warning-light-what-it-means",
  title: "Engine warning light",
  excerpt: "A direct answer for drivers.",
  sections,
  metadata: {},
  seoTitle: "Engine warning light advice",
  seoDescription: "A complete engine warning light guide for UK drivers.",
  status: "published",
  publishedAt: "2026-08-13T09:00:00.000Z",
  updatedAt: "2026-08-13T10:00:00.000Z",
  article: { category: "Diagnostics", author: "SOB Autofix Team" },
  readingMinutes: 5,
});

describe("article structured data", () => {
  it("builds one BlogPosting and visible FAQ schema without duplicating breadcrumb schema", () => {
    const data = articleStructuredData(article([
      { type: "faqs", heading: "FAQs", items: [{ question: "Can I drive?", answer: "Stop if the light flashes." }] },
    ]));

    expect(data.map((item) => item["@type"])).toEqual(["BlogPosting", "FAQPage"]);
    expect(data[0]?.mainEntityOfPage).toEqual({ "@type": "WebPage", "@id": "http://localhost:3000/news/engine-warning-light-what-it-means" });
    expect(data[0]).toMatchObject({
      headline: "Engine warning light",
      description: "A complete engine warning light guide for UK drivers.",
      datePublished: "2026-08-13T09:00:00.000Z",
      dateModified: "2026-08-13T10:00:00.000Z",
      author: { "@type": "Organization", name: "SOB Autofix Team" },
      publisher: { "@type": "Organization", name: "SOB Autofix Limited" },
    });
    expect(data[1]?.mainEntity).toEqual([{ "@type": "Question", name: "Can I drive?", acceptedAnswer: { "@type": "Answer", text: "Stop if the light flashes." } }]);
  });

  it("omits FAQPage when the visible article has no FAQ section", () => {
    const data = articleStructuredData(article([{ type: "richText", paragraphs: ["Useful visible guidance."] }]));
    expect(data.map((item) => item["@type"])).toEqual(["BlogPosting"]);
  });

  it("serializes admin-managed JSON-LD without allowing a closing-script injection", () => {
    const html = renderToStaticMarkup(createElement(JsonLd, { value: { "@context": "https://schema.org", name: "</script><script>alert(1)</script>" } }));
    expect(html).not.toContain("</script><script>");
    expect(html).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
  });
});
