import { ContentEditor } from "@/components/admin/content-editor";
import { automotiveAdviceArticleTemplate } from "@/lib/news/templates";
import { createAdminReadClient } from "@/lib/supabase/server";
import { saveContent, uploadArticleCover } from "../../actions";

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template: requestedTemplate } = await searchParams;
  const client = await createAdminReadClient();
  const { data } = client ? await client.from("media_assets").select("id,object_path,alt_text,category,published").order("created_at", { ascending: false }) : { data: [] };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const media = (data || []).map((item) => ({ id: item.id, alt: item.alt_text, category: item.category || undefined, published: item.published, url: base ? `${base}/storage/v1/object/public/public-media/${item.object_path}` : undefined }));
  const template = requestedTemplate === "automotive-advice" ? automotiveAdviceArticleTemplate : undefined;
  return <><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">News &amp; Blog</p><h1 className={`${template ? "mb-2" : "mb-8"} mt-2 text-4xl font-extrabold text-[#071127]`}>{template ? "New article from template" : "New article"}</h1>{template && <p className="mb-8 max-w-2xl text-sm leading-6 text-[#667586]">The reusable automotive advice structure is ready. Replace the blank sections with the story, review the related link and call to action, then save or publish.</p>}<ContentEditor articleMode media={media} entry={template} action={saveContent} coverUploadAction={uploadArticleCover} /></>;
}
