import { toggleMediaPublication, uploadMedia } from "../actions";
import { createClient } from "@/lib/supabase/server";

export default async function MediaPage() {
  const client = await createClient();
  const { data } = client ? await client.from("media_assets").select("id,object_path,alt_text,category,published,created_at").order("created_at", { ascending: false }) : { data: [] };
  return <>
    <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Real media only</p><h1 className="mt-2 text-4xl font-extrabold text-[#071127]">Media library</h1>
    <form action={uploadMedia} className="mt-8 grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6 md:grid-cols-2">
      <label className="text-sm font-bold">Image<input className="mt-2 block w-full" type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
      <label className="text-sm font-bold">Category<select name="category" className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4"><option value="news">News &amp; Blog</option><option value="diagnostics">Diagnostics</option><option value="engine-repairs">Engine repairs</option><option value="electrical-repairs">Electrical repairs</option><option value="servicing">Servicing</option><option value="before-after">Before &amp; after</option><option value="workshop">Workshop</option></select></label>
      <label className="text-sm font-bold md:col-span-2">Alt text<input name="alt" required minLength={5} className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4" /></label>
      <button className="min-h-11 rounded-lg bg-[#1974E2] px-4 font-bold text-white md:col-span-2">Upload as draft</button>
    </form>
    <div className="mt-8 grid gap-4">{(data || []).map((asset) => <article key={asset.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E4EAF0] bg-white p-5"><div><strong className="text-[#071127]">{asset.alt_text}</strong><span className="block text-xs text-[#667586]">{asset.category} · {asset.object_path}</span></div><form action={toggleMediaPublication}><input type="hidden" name="id" value={asset.id} /><input type="hidden" name="published" value={String(!asset.published)} /><button className="rounded-lg border border-[#1974E2]/30 px-4 py-2 text-sm font-bold text-[#1974E2]">{asset.published ? "Unpublish" : "Publish"}</button></form></article>)}{!data?.length && <p className="rounded-2xl bg-white p-8 text-center text-[#667586]">No client media uploaded.</p>}</div>
  </>;
}
