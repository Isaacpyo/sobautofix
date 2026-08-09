import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

export type PublicReview = { id: string; authorName: string; rating: number; text: string; sourceUri: string; publishedAt?: string };

export async function getVisibleReviews() {
  const admin = createAdminClient();
  if (!admin) return [] as PublicReview[];
  const { data } = await admin.from("reviews").select("id,author_name,rating,text,source_uri,published_at").eq("visible", true).order("published_at", { ascending: false }).limit(5);
  return (data || []).map((review) => ({ id: review.id, authorName: review.author_name, rating: review.rating, text: review.text, sourceUri: review.source_uri, publishedAt: review.published_at || undefined }));
}
