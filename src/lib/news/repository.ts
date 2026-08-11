import "server-only";

import { mapContentEntry } from "@/lib/content/repository";
import { calculateReadingMinutes, parseArticleMetadata, type NewsArticle } from "@/lib/news/article";
import { createClient } from "@/lib/supabase/server";

type ContentRow = Parameters<typeof mapContentEntry>[0];

export async function getPublishedArticles(limit?: number) {
  const client = await createClient();
  if (!client) return [] as NewsArticle[];

  let query = client
    .from("content_entries")
    .select("*")
    .eq("kind", "article")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return hydrateArticles(client, (data || []) as ContentRow[]);
}

export async function getPublishedArticle(slug: string) {
  const client = await createClient();
  if (!client) return null;
  const { data } = await client
    .from("content_entries")
    .select("*")
    .eq("kind", "article")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  return (await hydrateArticles(client, [data as ContentRow]))[0] || null;
}

export async function getRelatedArticles(article: NewsArticle, limit = 3) {
  const articles = (await getPublishedArticles(12)).filter((candidate) => candidate.id !== article.id);
  return articles
    .sort((left, right) => Number(right.article.category === article.article.category) - Number(left.article.category === article.article.category))
    .slice(0, limit);
}

async function hydrateArticles(
  client: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  rows: ContentRow[],
): Promise<NewsArticle[]> {
  const entries = rows.map(mapContentEntry);
  const mediaIds = [...new Set(entries.map((entry) => parseArticleMetadata(entry.metadata).coverImageId).filter((id): id is string => Boolean(id)))];
  const { data: media } = mediaIds.length
    ? await client.from("media_assets").select("id,object_path,alt_text").in("id", mediaIds).eq("published", true)
    : { data: [] };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const covers = new Map((media || []).map((asset) => [asset.id, {
    id: asset.id,
    url: `${base}/storage/v1/object/public/public-media/${asset.object_path}`,
    alt: asset.alt_text,
  }]));

  return entries.map((entry) => {
    const article = parseArticleMetadata(entry.metadata);
    return {
      ...entry,
      article,
      cover: article.coverImageId ? covers.get(article.coverImageId) : undefined,
      readingMinutes: calculateReadingMinutes(entry.sections),
    };
  });
}
