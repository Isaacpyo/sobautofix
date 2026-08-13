import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/news/article-view";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { createMetadata } from "@/lib/seo";
import { getPublishedArticle, getRelatedArticles } from "@/lib/news/repository";
import type { NewsArticle } from "@/lib/news/article";

export function articleStructuredData(article: NewsArticle) {
  const url = new URL(`/news/${article.slug}`, siteConfig.siteUrl).toString();
  const schemas: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: article.seoDescription,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      author: { "@type": "Organization", name: article.article.author },
      publisher: { "@type": "Organization", name: siteConfig.legalName, url: siteConfig.siteUrl },
      image: article.cover?.url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
  ];
  const faqItems = article.sections
    .filter((section) => section.type === "faqs")
    .flatMap((section) => section.items);
  if (faqItems.length) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }
  return schemas;
}

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

  return (
    <>
      <JsonLd value={articleStructuredData(article)} />
      <ArticleView article={article} related={related} />
    </>
  );
}
