import { describe, expect, it } from "vitest";
import { createReviewHealthChecks, type ReviewHealthRow } from "@/lib/reviews/health";

const currentReview: ReviewHealthRow = { provider: "google", rating: 5, text: "Excellent service", source_uri: "https://maps.google.com/review", visible: true, fetched_at: "2026-08-26T10:00:00Z" };

describe("review health monitoring", () => {
  it("reports a fully operational review pipeline", () => {
    const checks = createReviewHealthChecks({ credentialsReady: true, databaseReady: true, reviews: [currentReview], now: new Date("2026-08-28T10:00:00Z") });
    expect(checks.every((check) => check.state === "healthy")).toBe(true);
    expect(checks.find((check) => check.label === "Public display")?.status).toBe("Operational");
  });

  it("surfaces missing configuration, stale sync, moderation work and no public reviews", () => {
    const checks = createReviewHealthChecks({ credentialsReady: false, databaseReady: true, reviews: [{ ...currentReview, visible: false, fetched_at: "2026-08-01T10:00:00Z" }], now: new Date("2026-08-28T10:00:00Z") });
    expect(checks.find((check) => check.label === "Google Places connection")?.state).toBe("warning");
    expect(checks.find((check) => check.label === "Sync freshness")?.status).toBe("Sync recommended");
    expect(checks.find((check) => check.label === "Moderation queue")?.status).toBe("1 pending");
    expect(checks.find((check) => check.label === "Public display")?.status).toBe("No reviews live");
  });

  it("marks database and malformed review records as degraded", () => {
    const checks = createReviewHealthChecks({ credentialsReady: true, databaseReady: false, reviews: [{ ...currentReview, rating: 8, source_uri: "invalid" }] });
    expect(checks.find((check) => check.label === "Reviews database")?.state).toBe("degraded");
    expect(checks.find((check) => check.label === "Review data integrity")?.status).toBe("1 invalid");
  });
});
