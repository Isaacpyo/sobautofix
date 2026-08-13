import type { MetadataRoute } from "next";
import { diagnostics, services, siteConfig } from "@/config/site";
import { getPublishedContentByKinds } from "@/lib/content/repository";
import { getPublishedMedia } from "@/lib/media/repository";
import { getVisibleReviews } from "@/lib/reviews/repository";
import { getPublicSaleVehicles } from "@/lib/sales/repository";
import type { ContentEntry, SaleVehicle } from "@/types/domain";

const CORE_PATHS = [
  "", "/about", "/contact", "/book", "/get-a-quote", "/faqs", "/fleet", "/mobile-mechanic",
  "/vehicle-check", "/vehicle-inspections", "/vehicle-recovery", "/services", "/diagnostics",
  "/services/repairs-maintenance", "/services/mobile-specialist", "/areas", "/areas/doncaster",
  "/cars-for-sale", "/news", "/privacy", "/cookies", "/terms",
] as const;

type SitemapInput = {
  baseUrl: string;
  content: ContentEntry[];
  vehicles: SaleVehicle[];
  hasReviews: boolean;
  hasMedia: boolean;
};

function sitemapBaseUrl(value: string) {
  const url = new URL(value);
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without a path, query, or credentials");
  }
  if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("NEXT_PUBLIC_SITE_URL must not use localhost in production");
  }
  return url.origin;
}

function validLastModified(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid sitemap last-modified date for ${label}`);
  return date;
}

function contentPath(entry: ContentEntry) {
  switch (entry.kind) {
    case "core_page": return `/${entry.slug}`;
    case "article": return `/news/${entry.slug}`;
    case "area": return `/areas/${entry.slug}`;
    case "service": return `/services/${entry.slug}`;
    case "diagnostic": return `/diagnostics/${entry.slug}`;
    case "faq": return null;
  }
}

export function buildSitemap({ baseUrl, content, vehicles, hasReviews, hasMedia }: SitemapInput): MetadataRoute.Sitemap {
  const base = sitemapBaseUrl(baseUrl);
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const add = (path: string, entry: Omit<MetadataRoute.Sitemap[number], "url">) => {
    const url = new URL(path || "/", base).toString();
    entries.set(url, { url, ...entry });
  };

  for (const path of CORE_PATHS) add(path, { changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 });
  for (const item of services.filter((candidate) => candidate.published)) add(`/services/${item.slug}`, { changeFrequency: "monthly", priority: 0.7 });
  for (const item of diagnostics.filter((candidate) => candidate.published)) add(`/diagnostics/${item.slug}`, { changeFrequency: "monthly", priority: 0.7 });
  if (hasReviews) add("/reviews", { changeFrequency: "monthly", priority: 0.7 });
  if (hasMedia) add("/gallery", { changeFrequency: "monthly", priority: 0.7 });

  for (const entry of content) {
    const path = contentPath(entry);
    if (!path) continue;
    add(path, {
      lastModified: validLastModified(entry.updatedAt, path),
      changeFrequency: entry.kind === "article" ? "weekly" : "monthly",
      priority: entry.kind === "article" ? 0.75 : 0.7,
    });
  }

  for (const vehicle of vehicles) {
    const path = `/cars-for-sale/${vehicle.slug}`;
    add(path, { lastModified: validLastModified(vehicle.updatedAt, path), changeFrequency: "weekly", priority: 0.8 });
  }

  return [...entries.values()];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const strict = { throwOnError: true };
  const [content, vehicles, reviews, media] = await Promise.all([
    getPublishedContentByKinds(["core_page", "area", "article", "service", "diagnostic"], strict),
    getPublicSaleVehicles(strict),
    getVisibleReviews(strict),
    getPublishedMedia(undefined, strict),
  ]);

  return buildSitemap({ baseUrl: siteConfig.siteUrl, content, vehicles, hasReviews: reviews.length > 0, hasMedia: media.length > 0 });
}
