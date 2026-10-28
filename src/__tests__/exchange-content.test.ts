import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exchangePublicDefaults, NOT_PUBLISHED_COPY } from "@/config/exchange";
import { analyticsEvents, sanitizeAnalyticsProperties } from "@/lib/analytics/events";
import { guardExchangeContent } from "@/lib/content-guard";
import { buildRobotsTxt, buildSitemapXml } from "@/lib/exchange/public/seo";
import { renderSellerSubmissionReceived, renderVehicleEnquiryReceived } from "@/lib/email/templates/exchange";

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

const exchangeSources = ["src/app/exchange", "src/components/exchange", "src/lib/exchange/public", "src/app/api/exchange"].flatMap((root) => walk(join(process.cwd(), root)));

describe("exchange customer copy", () => {
  it("never offers test-centre services, only vehicle facts", () => {
    for (const file of exchangeSources) expect(guardExchangeContent(readFileSync(file, "utf8")), file).toEqual({ safe: true });
    expect(guardExchangeContent({ exchangePublicDefaults, NOT_PUBLISHED_COPY })).toEqual({ safe: true });
  });

  it("makes no unsupported promises in customer-facing source", () => {
    const banned = [/fully (approved|inspected)/i, /\bguarantee(d)?\b/i, /within \d+ (hours?|minutes?|days?)/i, /\bAA approved\b/i, /\bRAC approved\b/i, /\b\d+-point (check|inspection)\b/i];
    for (const file of exchangeSources) {
      const source = readFileSync(file, "utf8");
      for (const pattern of banned) expect(pattern.test(source), `${file} matches ${pattern}`).toBe(false);
    }
  });

  it("only shows a response-time promise that staff have set", () => {
    const base = { exchangeName: "SOB Auto Exchange", exchangeUrl: "https://exchange.example", submissionId: "s", reference: "SELL-1", kind: "sell" as const, customerName: "Sam", phone: "0700", preferredContact: "phone", vehicleSummary: "2016 Peugeot 208", photoCount: 0 };
    expect(renderSellerSubmissionReceived(base).text).not.toMatch(/within|working day|hours/i);
    expect(renderSellerSubmissionReceived({ ...base, responsePromise: "We usually reply the same day." }).text).toContain("We usually reply the same day.");
    expect(renderSellerSubmissionReceived(base).text).toContain("provisional");
  });

  it("tells customers a viewing is a request until confirmed", () => {
    const email = renderVehicleEnquiryReceived({ exchangeName: "SOB Auto Exchange", exchangeUrl: "https://exchange.example", enquiryId: "e", intent: "viewing", customerName: "Alex", phone: "0700", preferredContact: "phone", vehicleName: "2019 Ford Focus", vehiclePrice: "£9,495", vehicleUrl: "https://exchange.example/cars/x", requestedTime: "Saturday 31 October 2026 at 11:00" });
    expect(email.text).toContain("not confirmed yet");
    expect(email.html).toContain("not yet confirmed");
  });
});

describe("exchange analytics and SEO", () => {
  it("registers the exchange events and strips personal properties", () => {
    for (const event of ["exchange_vehicle_viewed", "viewing_requested", "vehicle_question_sent", "vehicle_contact_clicked", "seller_form_started", "seller_form_completed"]) {
      expect(analyticsEvents).toContain(event);
    }
    expect(sanitizeAnalyticsProperties({ name: "Sam", message: "hi", registration: "AB12CDE", email: "a@b.c", intent: "viewing", photos: 2 })).toEqual({ intent: "viewing", photos: 2 });
  });

  it("disallows indexing outside the production exchange host and lists exchange URLs", () => {
    expect(buildRobotsTxt(false, "https://exchange.sobautofix.com/sitemap.xml")).toBe("User-agent: *\nDisallow: /\n");
    expect(buildRobotsTxt(true, "https://exchange.sobautofix.com/sitemap.xml")).toContain("Sitemap: https://exchange.sobautofix.com/sitemap.xml");
    const xml = buildSitemapXml([{ url: "https://exchange.sobautofix.com/cars?a=1&b=2", lastModified: "2026-10-28T10:00:00Z", priority: 0.9 }]);
    expect(xml).toContain("<loc>https://exchange.sobautofix.com/cars?a=1&amp;b=2</loc>");
    expect(xml).toContain("<lastmod>2026-10-28T10:00:00.000Z</lastmod>");
  });
});
