import "server-only";

import type { Metadata } from "next";
import { exchangeCanonical, isExchangeIndexable } from "@/lib/exchange/links";
import { getExchangeSettings } from "@/lib/exchange/settings";

/**
 * Page metadata for SOB Auto Exchange: title under the configurable name,
 * canonical on the exchange host, and noindex everywhere except the real
 * exchange host in production (previews and the /exchange fallback path
 * are never indexed). Pass `index: false` for pages that must never be
 * indexed, such as sold cars and form confirmations.
 */
export async function exchangeMetadata(input: { title?: string; description?: string; path: string; index?: boolean; image?: string }): Promise<Metadata> {
  const [settings, indexable] = await Promise.all([getExchangeSettings(), isExchangeIndexable()]);
  const canonical = exchangeCanonical(input.path);
  const title = input.title ? `${input.title} | ${settings.name}` : `${settings.name}: used cars and car buying from SOB Autofix`;
  const description = input.description || settings.tagline;
  const allowIndex = indexable && input.index !== false;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: indexable },
    openGraph: { type: "website", url: canonical, siteName: settings.name, title, description, ...(input.image ? { images: [{ url: input.image }] } : {}) },
    twitter: { card: "summary_large_image", title, description },
  };
}
