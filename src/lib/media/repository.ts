import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

export async function getPublishedMedia(category?: string) {
  const admin = createAdminClient(); const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!admin || !base) return [] as Array<{ id: string; url: string; alt: string; category?: string }>;
  let query = admin.from("media_assets").select("id,object_path,alt_text,category").eq("published", true);
  if (category) query = query.eq("category", category);
  const { data } = await query.order("created_at", { ascending: false });
  return (data || []).map((asset) => ({ id: asset.id, url: `${base}/storage/v1/object/public/public-media/${asset.object_path}`, alt: asset.alt_text, category: asset.category || undefined }));
}
