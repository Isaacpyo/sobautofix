import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { diagnostics, services } from "@/config/site";
import { getPublishedContentByKinds } from "@/lib/content/repository";
import { getPublishedMedia } from "@/lib/media/repository";
import { getVisibleReviews } from "@/lib/reviews/repository";
import { getPublicSaleVehicles } from "@/lib/sales/repository";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [content, vehicles, reviews, media] = await Promise.all([getPublishedContentByKinds(["area", "article", "service", "diagnostic"]), getPublicSaleVehicles(), getVisibleReviews(), getPublishedMedia()]);
  const base = siteConfig.siteUrl;
  const core = ["", "/about", "/contact", "/book", "/get-a-quote", "/faqs", "/fleet", "/mobile-mechanic", "/vehicle-check", "/vehicle-inspections", "/vehicle-recovery", "/services", "/diagnostics", "/areas", "/areas/doncaster", "/cars-for-sale", "/privacy", "/cookies", "/terms"];
  const seeded = [...services.filter((item) => item.published).map((item) => `/services/${item.slug}`), ...diagnostics.filter((item) => item.published).map((item) => `/diagnostics/${item.slug}`)];
  const cms = content.map((entry) => `/${entry.kind === "article" ? "advice" : entry.kind === "area" ? "areas" : entry.kind === "service" ? "services" : "diagnostics"}/${entry.slug}`);
  if (reviews.length) core.push("/reviews"); if (media.length) core.push("/gallery"); if (content.some((entry) => entry.kind === "article")) core.push("/advice");
  const pages: MetadataRoute.Sitemap = [...new Set([...core, ...seeded, ...cms])].map((path) => ({ url: new URL(path, base).toString(), lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 }));
  return pages.concat(vehicles.map((vehicle) => ({ url: new URL(`/cars-for-sale/${vehicle.slug}`, base).toString(), lastModified: new Date(vehicle.createdAt), changeFrequency: "weekly" as const, priority: 0.8 })));
}
