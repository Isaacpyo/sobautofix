import { siteConfig } from "@/config/site";
import { getPublishedArticles } from "@/lib/news/repository";

export async function GET() {
  const articles = await getPublishedArticles(50);
  const items = articles.map((article) => {
    const url = new URL(`/news/${article.slug}`, siteConfig.siteUrl).toString();
    return `<item><title>${xml(article.title)}</title><link>${xml(url)}</link><guid>${xml(url)}</guid><description>${xml(article.excerpt)}</description><pubDate>${new Date(article.publishedAt || article.updatedAt).toUTCString()}</pubDate></item>`;
  }).join("");
  const feedUrl = new URL("/news/feed.xml", siteConfig.siteUrl).toString();
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>SOB Autofix News &amp; Blog</title><link>${xml(new URL("/news", siteConfig.siteUrl).toString())}</link><description>Automotive advice, insights and updates from SOB Autofix.</description><atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${xml(feedUrl)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
