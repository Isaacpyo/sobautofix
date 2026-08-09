import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentRenderer } from "@/components/content/content-renderer";
import { mapContentEntry } from "@/lib/content/repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Content preview", robots: { index: false, follow: false } };

export default async function AdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  if (!client) notFound();
  const { data } = await client.from("content_entries").select("*").eq("id", (await params).id).maybeSingle();
  if (!data) notFound();
  const entry = mapContentEntry(data as Parameters<typeof mapContentEntry>[0]);
  return <div className="-m-6 lg:-m-10"><div className="sticky top-0 z-50 bg-amber-300 px-4 py-3 text-center text-sm font-extrabold text-[#071127]">Authenticated preview · {entry.status} · not public</div><ContentRenderer entry={entry} /></div>;
}
