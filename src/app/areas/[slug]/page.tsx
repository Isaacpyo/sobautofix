import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentRenderer } from "@/components/content/content-renderer";
import { getPublishedContent } from "@/lib/content/repository";
import { createMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const entry = await getPublishedContent("area", (await params).slug); return entry ? createMetadata(entry.seoTitle, entry.seoDescription, `/areas/${entry.slug}`) : {}; }
export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) { const entry = await getPublishedContent("area", (await params).slug); if (!entry) notFound(); return <ContentRenderer entry={entry} />; }
