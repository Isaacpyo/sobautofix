// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleShare, buildArticleShareLinks } from "@/components/news/article-share";

const title = "How to diagnose an engine warning light";
const url = "https://sobautofix.com/news/engine-warning-light";

describe("article sharing", () => {
  it("builds encoded share URLs for the supported social platforms", () => {
    const links = buildArticleShareLinks(title, url);

    expect(links.map((link) => link.label)).toEqual([
      "Share on Facebook",
      "Share on X",
      "Share on LinkedIn",
      "Share on WhatsApp",
    ]);
    expect(links[0]?.href).toContain(encodeURIComponent(url));
    expect(links[1]?.href).toContain(encodeURIComponent(title));
    expect(links[2]?.href).toContain(encodeURIComponent(url));
    expect(links[3]?.href).toContain(encodeURIComponent(`${title} ${url}`));
  });

  it("renders safe external share links and copies the canonical article URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { container } = render(<ArticleShare title={title} url={url} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }

    fireEvent.click(screen.getAllByRole("button", { name: "Copy article link" })[0]!);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    expect(await screen.findAllByRole("button", { name: "Article link copied" })).toHaveLength(2);
    expect(container.querySelector(".top-\\[4\\.5rem\\].lg\\:hidden")).toBeInTheDocument();
    expect(container.querySelector(".lg\\:block .sticky.top-28")).toBeInTheDocument();
  });
});
