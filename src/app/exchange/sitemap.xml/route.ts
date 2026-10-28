import { exchangePolicyPages } from "@/config/exchange";
import { exchangeCanonical } from "@/lib/exchange/links";
import { buildSitemapXml, type SitemapEntry } from "@/lib/exchange/public/seo";
import { getListedStock } from "@/lib/exchange/public/stock";
import { getExchangeSettings } from "@/lib/exchange/settings";

// Served at exchange.sobautofix.com/sitemap.xml through the proxy rewrite.
// Exchange-host URLs only; the main site's sitemap is unchanged.
export async function GET() {
  const [stock, settings] = await Promise.all([getListedStock(), getExchangeSettings()]);
  const pages: SitemapEntry[] = [
    { url: exchangeCanonical("/"), priority: 1 },
    { url: exchangeCanonical("/cars"), priority: 0.9 },
    { url: exchangeCanonical("/sell"), priority: 0.8 },
    { url: exchangeCanonical("/part-exchange"), priority: 0.6 },
    { url: exchangeCanonical("/how-buying-works"), priority: 0.6 },
    { url: exchangeCanonical("/about"), priority: 0.5 },
    { url: exchangeCanonical("/contact"), priority: 0.5 },
    ...exchangePolicyPages.filter((page) => settings.policies[page.key]?.trim()).map((page) => ({ url: exchangeCanonical(`/policies/${page.slug}`), priority: 0.3 })),
    ...stock.vehicles.filter((vehicle) => vehicle.status === "available" || vehicle.status === "reserved").map((vehicle) => ({ url: exchangeCanonical(`/cars/${vehicle.slug}`), lastModified: vehicle.updatedAt, priority: 0.8 })),
  ];
  return new Response(buildSitemapXml(pages), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
