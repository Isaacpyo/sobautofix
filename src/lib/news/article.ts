import type { ContentEntry, ContentSection } from "@/types/domain";

export const articleCategories = [
  "Diagnostics",
  "Car Care",
  "Repairs & Maintenance",
  "Buying Advice",
  "Company News",
  "Vehicle Guides",
  "Advice & Guides",
] as const;

export type ArticleCategory = (typeof articleCategories)[number];

export type ArticleMetadata = {
  category: ArticleCategory;
  author: string;
  coverImageId?: string;
  featured?: boolean;
};

export type NewsArticle = ContentEntry & {
  article: ArticleMetadata;
  cover?: { id: string; url: string; alt: string };
  readingMinutes: number;
};

export function parseArticleMetadata(metadata: Record<string, unknown>): ArticleMetadata {
  const category = articleCategories.includes(metadata.category as ArticleCategory)
    ? metadata.category as ArticleCategory
    : "Advice & Guides";
  const author = typeof metadata.author === "string" && metadata.author.trim()
    ? metadata.author.trim()
    : "SOB Autofix Team";
  const coverImageId = typeof metadata.coverImageId === "string" && metadata.coverImageId
    ? metadata.coverImageId
    : undefined;

  return { category, author, coverImageId, featured: metadata.featured === true };
}

export function calculateReadingMinutes(sections: ContentSection[]) {
  const words = sections.flatMap((section) => {
    if (section.type === "richText") return [section.heading || "", ...section.paragraphs];
    if (section.type === "faqs") return [section.heading, ...section.items.flatMap((item) => [item.question, item.answer])];
    return [];
  }).join(" ").trim().split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

export function formatArticleDate(value?: string) {
  if (!value) return "Publication pending";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}
