import Image from "next/image";
import { toggleMediaPublication, updateMediaDetails, uploadMedia } from "../actions";
import { createAdminReadClient } from "@/lib/supabase/server";

const categories = [
  ["news", "News & Blog"],
  ["diagnostics", "Diagnostics"],
  ["engine-repairs", "Engine repairs"],
  ["electrical-repairs", "Electrical repairs"],
  ["servicing", "Servicing"],
  ["before-after", "Before & after"],
  ["workshop", "Workshop"],
] as const;

const categoryLabel = new Map<string, string>(categories);

export default async function MediaPage() {
  const client = await createAdminReadClient();
  const { data } = client
    ? await client.from("media_assets").select("id,object_path,alt_text,category,published,created_at").order("created_at", { ascending: false })
    : { data: [] };
  const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return <>
    <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Real media only</p>
    <h1 className="mt-2 text-4xl font-extrabold text-[#071127]">Media library</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667586]">Preview, edit and publish the genuine images used across the website. Manage article publication from News.</p>

    <form action={uploadMedia} className="mt-8 grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6 md:grid-cols-2">
      <label className="text-sm font-bold">Image<input className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-[#C9D5E2] bg-white text-sm font-medium text-[#586575] file:mr-4 file:min-h-12 file:cursor-pointer file:border-0 file:border-r file:border-[#C9D5E2] file:bg-[#EAF3FF] file:px-5 file:font-bold file:text-[#1446A5] hover:border-[#1974E2]" type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
      <label className="text-sm font-bold">Category<select name="category" className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-bold md:col-span-2">Alt text<input name="alt" required minLength={5} maxLength={180} className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4" /></label>
      <button className="min-h-11 rounded-lg bg-[#1974E2] px-4 font-bold text-white md:col-span-2">Upload as draft</button>
    </form>

    <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {(data || []).map((asset) => {
        const imageUrl = storageBase ? `${storageBase}/storage/v1/object/public/public-media/${asset.object_path}` : null;
        return <article key={asset.id} className="overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white shadow-sm">
          <a href={imageUrl || undefined} target={imageUrl ? "_blank" : undefined} rel={imageUrl ? "noreferrer" : undefined} className="relative block aspect-[4/3] bg-[#E9EEF3]">
            {imageUrl
              ? <Image src={imageUrl} alt={asset.alt_text} fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-200 hover:scale-[1.02]" />
              : <span className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-[#667586]">Image preview is not configured</span>}
          </a>

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#667586]">{categoryLabel.get(asset.category || "") || asset.category || "Uncategorised"}</p>
                <h2 className="mt-2 text-base font-bold leading-6 text-[#071127]">{asset.alt_text}</h2>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${asset.published ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{asset.published ? "Published" : "Draft"}</span>
            </div>

            <details className="group mt-5 border-t border-[#E4EAF0] pt-4">
              <summary className="cursor-pointer list-none text-sm font-bold text-[#1974E2] marker:hidden group-open:mb-4">Edit details <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-180">⌄</span></summary>
              <form action={updateMediaDetails} className="grid gap-4 rounded-xl bg-[#F4F7FA] p-4">
                <input type="hidden" name="id" value={asset.id} />
                <label className="text-sm font-bold text-[#071127]">Alt text<input name="alt" required minLength={5} maxLength={180} defaultValue={asset.alt_text} className="mt-2 block min-h-11 w-full rounded-lg border border-[#D7E0E9] bg-white px-3 font-normal" /></label>
                <label className="text-sm font-bold text-[#071127]">Category<select name="category" defaultValue={asset.category || "news"} className="mt-2 block min-h-11 w-full rounded-lg border border-[#D7E0E9] bg-white px-3 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <button className="min-h-11 rounded-lg bg-[#071127] px-4 text-sm font-bold text-white">Save changes</button>
              </form>
            </details>

            {!asset.published && <form action={toggleMediaPublication} className="mt-4">
              <input type="hidden" name="id" value={asset.id} />
              <input type="hidden" name="published" value="true" />
              <button className="min-h-11 w-full rounded-lg border border-[#1974E2]/30 px-4 text-sm font-bold text-[#1974E2]">Publish</button>
            </form>}
          </div>
        </article>;
      })}
      {!data?.length && <p className="rounded-2xl bg-white p-8 text-center text-[#667586] sm:col-span-2 xl:col-span-3">No client media uploaded.</p>}
    </div>
  </>;
}
