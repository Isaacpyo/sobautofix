import { notFound } from "next/navigation";
import { ContentEditor } from "@/components/admin/content-editor";
import { mapContentEntry } from "@/lib/content/repository";
import { createAdminReadClient as createClient } from "@/lib/supabase/server";
import { deleteContent, restoreContentRevision, saveContent, uploadArticleCover } from "../../actions";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  if (!client) notFound();
  const id = (await params).id;
  const [{ data }, { data: revisions }, { data: mediaRows }] = await Promise.all([
    client.from("content_entries").select("*").eq("id", id).eq("kind", "article").maybeSingle(),
    client.from("content_revisions").select("id,created_at").eq("content_entry_id", id).order("created_at", { ascending: false }).limit(20),
    client.from("media_assets").select("id,object_path,alt_text,category,published").order("created_at", { ascending: false }),
  ]);
  if (!data) notFound();
  const entry = mapContentEntry(data as Parameters<typeof mapContentEntry>[0]);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const media = (mediaRows || []).map((item) => ({ id: item.id, alt: item.alt_text, category: item.category || undefined, published: item.published, url: base ? `${base}/storage/v1/object/public/public-media/${item.object_path}` : undefined }));
  return <>
    <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">News &amp; Blog</p><h1 className="mb-8 mt-2 text-4xl font-extrabold text-[#071127]">Edit {entry.title}</h1>
    <ContentEditor articleMode media={media} entry={entry} action={saveContent} coverUploadAction={uploadArticleCover} />
    <section className="mt-8 rounded-2xl border border-[#E4EAF0] bg-white p-6"><h2 className="text-2xl font-bold text-[#071127]">Revision history</h2><p className="mt-2 text-sm text-[#667586]">Restoring a revision first saves the current version, so the operation is reversible.</p><div className="mt-5 grid gap-3">{(revisions || []).map((revision) => <form key={revision.id} action={restoreContentRevision} className="flex items-center justify-between rounded-xl bg-[#F4F7FA] p-4"><input type="hidden" name="contentId" value={entry.id} /><input type="hidden" name="revisionId" value={revision.id} /><span className="text-sm font-semibold text-[#586575]">{new Date(revision.created_at).toLocaleString("en-GB")}</span><button className="rounded-lg border border-[#1974E2]/30 bg-white px-4 py-2 text-sm font-bold text-[#1974E2]">Restore</button></form>)}{!revisions?.length && <p className="text-sm text-[#667586]">No earlier revisions yet.</p>}</div></section>
    <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="text-xl font-bold text-red-900">Delete article</h2><p className="mt-2 text-sm text-red-800">This permanently removes the article and its revisions. Archive it when the record should be retained.</p><form action={deleteContent} className="mt-4"><input type="hidden" name="id" value={entry.id} /><button className="rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white">Delete permanently</button></form></section>
  </>;
}
