import { LayoutTemplate, Newspaper, Plus } from "lucide-react";
import Link from "next/link";
import { parseArticleMetadata } from "@/lib/news/article";
import { createClient } from "@/lib/supabase/server";

const statuses = ["all", "draft", "published", "scheduled", "archived"] as const;

export default async function NewsAdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status;
  const status = statuses.includes(requested as typeof statuses[number]) ? requested as typeof statuses[number] : "all";
  const client = await createClient();
  let query = client?.from("content_entries").select("id,slug,title,status,metadata,published_at,updated_at").eq("kind", "article").order("updated_at", { ascending: false });
  if (status !== "all") query = query?.eq("status", status);
  const { data } = query ? await query : { data: [] };

  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Public publishing</p><h1 className="mt-2 text-4xl font-extrabold text-[#071127]">News &amp; Blog</h1><p className="mt-2 max-w-2xl text-sm text-[#667586]">Draft, schedule, preview and publish useful automotive articles.</p></div><div className="flex flex-wrap gap-3"><Link href="/admin/news/new?template=automotive-advice" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#1974E2]/30 bg-white px-4 font-bold text-[#1446A5]"><LayoutTemplate size={17} />Use template</Link><Link href="/admin/news/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1974E2] px-4 font-bold text-white"><Plus size={17} />Blank article</Link></div></div>
    <nav aria-label="Filter articles by status" className="mt-7 flex gap-2 overflow-x-auto pb-2">{statuses.map((item) => <Link key={item} href={item === "all" ? "/admin/news" : `/admin/news?status=${item}`} aria-current={status === item ? "page" : undefined} className={status === item ? "rounded-full bg-[#071127] px-4 py-2 text-sm font-bold whitespace-nowrap text-white" : "rounded-full border border-[#D7E0E9] bg-white px-4 py-2 text-sm font-bold whitespace-nowrap text-[#586575]"}>{item.charAt(0).toUpperCase() + item.slice(1)}</Link>)}</nav>
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[#E4EAF0] bg-white"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[#F4F7FA] text-xs text-[#667586] uppercase"><tr><th className="p-4">Article</th><th className="p-4">Category</th><th className="p-4">Author</th><th className="p-4">Status</th><th className="p-4">Published</th><th className="p-4">Updated</th></tr></thead><tbody>{(data || []).map((entry) => { const details = parseArticleMetadata((entry.metadata || {}) as Record<string, unknown>); return <tr key={entry.id} className="border-t border-[#E4EAF0]"><td className="p-4"><Link className="font-bold text-[#071127] hover:text-[#1974E2]" href={`/admin/news/${entry.id}`}>{entry.title}</Link><span className="block text-xs text-[#667586]">/news/{entry.slug}</span></td><td className="p-4">{details.category}</td><td className="p-4">{details.author}</td><td className="p-4"><span className={entry.status === "published" ? "rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800" : entry.status === "scheduled" ? "rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800" : "rounded-full bg-[#E4EAF0] px-2 py-1 text-xs font-bold text-[#586575]"}>{entry.status}</span></td><td className="p-4 text-[#667586]">{entry.published_at ? new Date(entry.published_at).toLocaleDateString("en-GB") : "—"}</td><td className="p-4 text-[#667586]">{new Date(entry.updated_at).toLocaleDateString("en-GB")}</td></tr>; })}</tbody></table>{!data?.length && <div className="grid place-items-center px-6 py-14 text-center"><Newspaper size={34} className="text-[#9AA7B6]" /><h2 className="mt-4 text-xl font-bold text-[#071127]">No {status === "all" ? "" : `${status} `}articles yet</h2><p className="mt-2 text-sm text-[#667586]">Create an article and save it as a draft to begin.</p></div>}</div>
  </>;
}
