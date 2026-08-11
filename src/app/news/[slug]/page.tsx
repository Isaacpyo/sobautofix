import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/news/article-view";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { createMetadata } from "@/lib/seo";
import { getPublishedArticle, getRelatedArticles } from "@/lib/news/repository";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = await getPublishedArticle((await params).slug);
  if (!article) return {};
  const metadata = createMetadata(article.seoTitle, article.seoDescription, `/news/${article.slug}`);
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.article.author],
      images: article.cover ? [{ url: article.cover.url, alt: article.cover.alt }] : undefined,
    },
    twitter: {
      ...metadata.twitter,
      images: article.cover ? [article.cover.url] : undefined,
    },
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = await getPublishedArticle((await params).slug);
  if (!article) notFound();
  const related = await getRelatedArticles(article);
  const url = new URL(`/news/${article.slug}`, siteConfig.siteUrl).toString();

  return (
    <>
      <JsonLd value={[
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: article.title,
          description: article.excerpt,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
          author: { "@type": "Organization", name: article.article.author },
          publisher: { "@type": "Organization", name: siteConfig.legalName, url: siteConfig.siteUrl },
          image: article.cover?.url,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.siteUrl },
            { "@type": "ListItem", position: 2, name: "News & Blog", item: new URL("/news", siteConfig.siteUrl).toString() },
            { "@type": "ListItem", position: 3, name: article.title, item: url },
          ],
        },
      ]} />
      <ArticleView article={article} related={related} />
    </>
  );
}
