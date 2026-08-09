import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/auth/", "/api/"] }, sitemap: `${siteConfig.siteUrl}/sitemap.xml`, host: siteConfig.siteUrl };
}
