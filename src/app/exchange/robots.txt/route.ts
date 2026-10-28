import { exchangeCanonical, isExchangeIndexable } from "@/lib/exchange/links";
import { buildRobotsTxt } from "@/lib/exchange/public/seo";

// Served at exchange.sobautofix.com/robots.txt through the proxy rewrite.
export async function GET() {
  const body = buildRobotsTxt(await isExchangeIndexable(), exchangeCanonical("/sitemap.xml"));
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
