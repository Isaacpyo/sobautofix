// Pure builders for the exchange robots.txt and sitemap.xml.

export type SitemapEntry = { url: string; lastModified?: string; priority?: number };

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function buildSitemapXml(entries: SitemapEntry[]) {
  const body = entries.map((entry) => {
    const lastmod = entry.lastModified && !Number.isNaN(new Date(entry.lastModified).getTime()) ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>` : "";
    const priority = entry.priority !== undefined ? `<priority>${entry.priority.toFixed(1)}</priority>` : "";
    return `<url><loc>${escapeXml(entry.url)}</loc>${lastmod}${priority}</url>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}

/** Index only the real exchange host in production; everything else (previews, the /exchange fallback) is disallowed. */
export function buildRobotsTxt(indexable: boolean, sitemapUrl: string) {
  return indexable
    ? `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /more\n\nSitemap: ${sitemapUrl}\n`
    : "User-agent: *\nDisallow: /\n";
}
