// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleReviewsCarousel } from "@/components/reviews/google-reviews-carousel";
import type { PublicReview } from "@/lib/reviews/repository";

const supabase = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => supabase);

const reviews: PublicReview[] = [
  { id: "one", authorName: "Alex", authorUri: "https://maps.google.com/alex", rating: 5, text: "Careful diagnosis and a clear explanation.", sourceUri: "https://maps.google.com/one", publishedAt: "2026-07-04T10:00:00Z" },
  { id: "two", authorName: "Sam", rating: 4, text: "The second review.", sourceUri: "https://maps.google.com/two", publishedAt: "2026-06-03T10:00:00Z" },
];

describe("Google reviews carousel", () => {
  it("omits an empty carousel", () => {
    const { container } = render(<GoogleReviewsCarousel reviews={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one accessible review without misleading controls", () => {
    render(<GoogleReviewsCarousel reviews={[reviews[0]!]} />);
    expect(screen.getByText(/Careful diagnosis/)).toBeVisible();
    expect(screen.getByText("Rated 5 out of 5 stars")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next review" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View on Google/ })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Alex" })).toHaveAttribute("href", "https://maps.google.com/alex");
    expect(screen.getByText("Google Maps")).toHaveAttribute("translate", "no");
  });

  it("moves next, previous and wraps at both boundaries with one review visible", () => {
    render(<GoogleReviewsCarousel reviews={reviews} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText(/Careful diagnosis/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Next review" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText(/second review/)).toBeVisible();
    expect(screen.queryByText(/Careful diagnosis/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next review" }));
    expect(screen.getByText(/Careful diagnosis/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Previous review" }));
    expect(screen.getByText(/second review/)).toBeVisible();
  });

  it("supports horizontal swipe gestures without treating vertical scrolling as navigation", () => {
    render(<GoogleReviewsCarousel reviews={reviews} />);
    const carousel = screen.getByRole("region", { name: "Google customer reviews" });
    const viewport = carousel.querySelector("[aria-live='polite']")!;

    fireEvent.pointerDown(viewport, { pointerId: 1, isPrimary: true, button: 0, clientX: 180, clientY: 50 });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 90, clientY: 55 });
    expect(screen.getByText(/second review/)).toBeVisible();

    fireEvent.pointerDown(viewport, { pointerId: 2, isPrimary: true, button: 0, clientX: 90, clientY: 50 });
    fireEvent.pointerUp(viewport, { pointerId: 2, clientX: 180, clientY: 55 });
    expect(screen.getByText(/Careful diagnosis/)).toBeVisible();

    fireEvent.pointerDown(viewport, { pointerId: 3, isPrimary: true, button: 0, clientX: 180, clientY: 50 });
    fireEvent.pointerUp(viewport, { pointerId: 3, clientX: 120, clientY: 140 });
    expect(screen.getByText(/Careful diagnosis/)).toBeVisible();
  });
});

describe("public Google review data path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only visible reviews through the publishable public client", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "one", author_name: "Alex", author_uri: null, rating: 5, text: "Approved", source_uri: "https://maps.google.com", published_at: null }], error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn()
      .mockReturnValueOnce({ eq: (...args: unknown[]) => { eq(...args); return { order }; } })
      .mockReturnValue({ order });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    supabase.createPublicClient.mockReturnValue({ from });
    const { getVisibleReviews } = await import("@/lib/reviews/repository");

    await expect(getVisibleReviews()).resolves.toEqual([{ id: "one", authorName: "Alex", authorUri: undefined, rating: 5, text: "Approved", sourceUri: "https://maps.google.com", publishedAt: undefined }]);
    expect(from).toHaveBeenCalledWith("reviews");
    expect(select).toHaveBeenCalledWith("id,author_name,author_uri,rating,text,source_uri,published_at");
    expect(eq).toHaveBeenNthCalledWith(1, "provider", "google");
    expect(eq).toHaveBeenNthCalledWith(2, "visible", true);
  });

  it("does not expose the Google API or Supabase secret to the client component", () => {
    const client = readFileSync(join(process.cwd(), "src/components/reviews/google-reviews-carousel.tsx"), "utf8");
    expect(client).not.toMatch(/GOOGLE_PLACES_API_KEY|SUPABASE_SECRET_KEY|createAdminClient/);
  });

  it("places the shared section last on all five required public pages", () => {
    for (const file of ["src/app/page.tsx", "src/app/contact/page.tsx", "src/app/about/page.tsx", "src/app/cars-for-sale/page.tsx", "src/app/news/page.tsx"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).toContain("<GoogleReviewsSection />");
      expect(source.lastIndexOf("<GoogleReviewsSection />")).toBeGreaterThan(source.lastIndexOf("<section"));
    }
  });
});
