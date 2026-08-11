import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentRenderer } from "@/components/content/content-renderer";
import { ArticleView } from "@/components/news/article-view";
import { mapContentEntry } from "@/lib/content/repository";
import { calculateReadingMinutes, parseArticleMetadata, type NewsArticle } from "@/lib/news/article";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Content preview", robots: { index: false, follow: false } };

export default async function AdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  if (!client) notFound();
  const { data } = await client.from("content_entries").select("*").eq("id", (await params).id).maybeSingle();
  if (!data) notFound();
  const entry = mapContentEntry(data as Parameters<typeof mapContentEntry>[0]);
  let article: NewsArticle | null = null;
  if (entry.kind === "article") {
    const articleMetadata = parseArticleMetadata(entry.metadata);
    const { data: cover } = articleMetadata.coverImageId
      ? await client.from("media_assets").select("id,object_path,alt_text").eq("id", articleMetadata.coverImageId).maybeSingle()
      : { data: null };
    article = {
      ...entry,
      article: articleMetadata,
      readingMinutes: calculateReadingMinutes(entry.sections),
      cover: cover ? { id: cover.id, url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-media/${cover.object_path}`, alt: cover.alt_text } : undefined,
    };
  }
  return <div className="-m-6 lg:-m-10"><div className="sticky top-0 z-50 bg-amber-300 px-4 py-3 text-center text-sm font-extrabold text-[#071127]">Authenticated preview · {entry.status} · not public</div>{article ? <ArticleView article={article} preview /> : <ContentRenderer entry={entry} />}</div>;
}
