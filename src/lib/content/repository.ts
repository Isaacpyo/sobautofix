import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ContentEntry, ContentKind, ContentSection } from "@/types/domain";

type ContentRow = {
  id: string; kind: ContentKind; slug: string; title: string; excerpt: string; sections: ContentSection[]; metadata: Record<string, unknown>; seo_title: string; seo_description: string; status: ContentEntry["status"]; published_at: string | null; updated_at: string; author_id: string | null;
};

export function mapContentEntry(row: ContentRow): ContentEntry {
  return { id: row.id, kind: row.kind, slug: row.slug, title: row.title, excerpt: row.excerpt, sections: row.sections, metadata: row.metadata, seoTitle: row.seo_title, seoDescription: row.seo_description, status: row.status, publishedAt: row.published_at || undefined, updatedAt: row.updated_at, authorId: row.author_id || undefined };
}

export async function getPublishedContent(kind: ContentKind, slug: string) {
  const client = await createClient();
  if (!client) return null;
  const { data } = await client.from("content_entries").select("*").eq("kind", kind).eq("slug", slug).eq("status", "published").maybeSingle();
  return data ? mapContentEntry(data as ContentRow) : null;
}

export async function getPublishedContentByKinds(kinds: ContentKind[]) {
  const client = await createClient();
  if (!client) return [] as ContentEntry[];
  const { data } = await client.from("content_entries").select("*").in("kind", kinds).eq("status", "published").order("published_at", { ascending: false });
  return ((data || []) as ContentRow[]).map(mapContentEntry);
}
