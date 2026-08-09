import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const client = await createClient();
  const [enquiries, content, stock, failed] = client ? await Promise.all([
    client.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    client.from("content_entries").select("id", { count: "exact", head: true }).eq("status", "published"),
    client.from("sale_vehicles").select("id", { count: "exact", head: true }).in("status", ["available", "reserved"]),
    client.from("enquiries").select("id", { count: "exact", head: true }).eq("notification_status", "failed"),
  ]) : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }];
  const cards = [["New enquiries", enquiries.count], ["Published entries", content.count], ["Live vehicle stock", stock.count], ["Email failures", failed.count]];
  return <><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Operations overview</p><h1 className="mt-2 text-4xl font-extrabold text-[#071127]">Dashboard</h1><div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <article key={String(label)} className="rounded-2xl border border-[#E4EAF0] bg-white p-6"><p className="text-sm font-semibold text-[#667586]">{label}</p><strong className="mt-4 block text-4xl text-[#071127]">{value ?? 0}</strong></article>)}</div><div className="mt-8 rounded-2xl border border-[#E4EAF0] bg-white p-6"><h2 className="text-2xl font-bold text-[#071127]">Launch safeguards</h2><ul className="mt-4 grid gap-2 text-sm text-[#586575]"><li>• Draft content is never public or included in the sitemap.</li><li>• Publishing validates SEO fields, structured sections and prohibited customer-facing terms.</li><li>• Missing integrations appear in the health endpoint without exposing secret names.</li><li>• Public photos require useful alt text before publication.</li></ul></div></>;
}
