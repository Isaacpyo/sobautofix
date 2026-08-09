import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentRenderer } from "@/components/content/content-renderer";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { getPublishedContent } from "@/lib/content/repository";
import { createMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const entry = await getPublishedContent("article", (await params).slug); return entry ? createMetadata(entry.seoTitle, entry.seoDescription, `/advice/${entry.slug}`) : {}; }
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) { const entry = await getPublishedContent("article", (await params).slug); if (!entry) notFound(); return <><JsonLd value={{ "@context": "https://schema.org", "@type": "Article", headline: entry.title, description: entry.excerpt, datePublished: entry.publishedAt, dateModified: entry.updatedAt, author: { "@type": "Organization", name: siteConfig.name }, publisher: { "@type": "Organization", name: siteConfig.name } }} /><ContentRenderer entry={entry} /></>; }
