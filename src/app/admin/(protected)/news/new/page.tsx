import { ContentEditor } from "@/components/admin/content-editor";
import { createClient } from "@/lib/supabase/server";
import { saveContent } from "../../actions";

export default async function NewArticlePage() {
  const client = await createClient();
  const { data } = client ? await client.from("media_assets").select("id,alt_text,category,published").order("created_at", { ascending: false }) : { data: [] };
  const media = (data || []).map((item) => ({ id: item.id, alt: item.alt_text, category: item.category || undefined, published: item.published }));
  return <><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">News &amp; Blog</p><h1 className="mb-8 mt-2 text-4xl font-extrabold text-[#071127]">New article</h1><ContentEditor articleMode media={media} action={saveContent} /></>;
}
