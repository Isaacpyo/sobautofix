// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { articleMarkupToHtml, editorHtmlToArticleMarkup, sanitisePastedArticleHtml } from "@/lib/news/rich-text";

describe("article rich text compatibility", () => {
  it("round-trips supported visual formatting through the existing string storage", () => {
    const markup = "## Heading\n\nA **bold** and *italic* paragraph.\n\n- One\n- Two\n\n1. First\n2. Second\n\n> A quote\n\n[Diagnostics](/diagnostics)";
    const html = articleMarkupToHtml(markup);
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<ul>");
    expect(editorHtmlToArticleMarkup(html)).toBe(markup);
  });

  it("sanitises pasted HTML to the supported semantic allowlist", () => {
    const safe = sanitisePastedArticleHtml('<h1 style="color:red">Heading</h1><p class="WordStyle"><b>Useful</b> text<script>alert(1)</script></p><a href="javascript:alert(1)">Unsafe</a><a href="/book" style="font-family:serif">Book</a>');
    expect(safe).toContain("<h2>Heading</h2>");
    expect(safe).toContain("<strong>Useful</strong>");
    expect(safe).toContain('<a href="/book">Book</a>');
    expect(safe).not.toMatch(/script|javascript|style=|class=/);
  });
});
