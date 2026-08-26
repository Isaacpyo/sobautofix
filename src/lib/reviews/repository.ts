import "server-only";

import { createPublicClient } from "@/lib/supabase/server";

export type PublicReview = { id: string; authorName: string; authorUri?: string; rating: number; text: string; sourceUri: string; publishedAt?: string };

export async function getVisibleReviews(options: { throwOnError?: boolean } = {}) {
  const client = createPublicClient();
  if (!client) {
    if (options.throwOnError) throw new Error("Sitemap review source is not configured");
    return [] as PublicReview[];
  }
  const { data, error } = await client.from("reviews").select("id,author_name,author_uri,rating,text,source_uri,published_at").eq("provider", "google").eq("visible", true).order("published_at", { ascending: false }).limit(5);
  if (error && options.throwOnError) throw new Error("Sitemap review query failed", { cause: error });
  return (data || []).map((review) => ({ id: review.id, authorName: review.author_name, authorUri: review.author_uri || undefined, rating: review.rating, text: review.text, sourceUri: review.source_uri, publishedAt: review.published_at || undefined }));
}
