import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArticleCard } from "@/components/news/article-card";
import { ArticleShare } from "@/components/news/article-share";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { diagnostics, services, siteConfig } from "@/config/site";
import { formatArticleDate, type NewsArticle } from "@/lib/news/article";
import { getPublishedMedia } from "@/lib/media/repository";
import type { ContentSection } from "@/types/domain";

export async function ArticleView({ article, related = [], preview = false }: { article: NewsArticle; related?: NewsArticle[]; preview?: boolean }) {
  return (
    <article>
      <header className="bg-[#F4F7FA] py-10 sm:py-14 lg:py-16">
        <Container className="max-w-5xl">
          {!preview && <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News & Blog", href: "/news" }, { label: article.title, href: `/news/${article.slug}` }]} />}
          <div className={preview ? "" : "mt-9"}>
            <p className="text-xs font-extrabold tracking-[0.16em] text-[#1974E2] uppercase">{article.article.category}</p>
            <h1 className="text-balance mt-4 text-5xl leading-[0.95] font-extrabold text-[#071127] sm:text-6xl lg:text-7xl">{article.title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#586575]">{article.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-[#667586]">
              <span>By {article.article.author}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
              <span aria-hidden="true">·</span>
              <span>{article.readingMinutes} min read</span>
            </div>
          </div>
        </Container>
      </header>

      {article.cover && (
        <Container className="max-w-6xl py-8 sm:py-12">
          <div className="relative aspect-[16/8] overflow-hidden rounded-2xl bg-[#E4EAF0] sm:rounded-3xl">
            <Image src={article.cover.url} alt={article.cover.alt} fill priority sizes="(max-width: 1200px) 100vw, 1150px" className="object-cover" />
          </div>
        </Container>
      )}

      <div className={`relative ${article.cover ? "pb-16" : "py-12 sm:py-16"}`}>
        {!preview && (
          <ArticleShare
            title={article.title}
            url={new URL(`/news/${article.slug}`, siteConfig.siteUrl).toString()}
          />
        )}
        <div>
          {await Promise.all(article.sections.map((section, index) => renderArticleSection(section, index)))}
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-t border-[#E4EAF0] bg-[#F4F7FA] py-16 sm:py-20" aria-labelledby="related-articles-heading">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold tracking-[0.16em] text-[#1974E2] uppercase">Keep reading</p>
                <h2 id="related-articles-heading" className="mt-2 text-4xl font-extrabold text-[#071127]">Related articles</h2>
              </div>
              <Link href="/news" className="inline-flex items-center gap-2 font-bold text-[#1974E2]">View all News & Blog <ArrowRight size={16} /></Link>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">{related.map((item) => <ArticleCard key={item.id} article={item} />)}</div>
          </Container>
        </section>
      )}
    </article>
  );
}

async function renderArticleSection(section: ContentSection, index: number) {
  switch (section.type) {
    case "hero":
      return null;
    case "richText":
      return (
        <section key={index} className="py-7 first:pt-0">
          <Container className="max-w-3xl">
            {section.heading && <h2 className="text-3xl font-extrabold text-[#071127] sm:text-4xl">{section.heading}</h2>}
            <div className="mt-5 space-y-5 text-lg leading-8 text-[#3F4B59]">{renderArticleBody(section.paragraphs)}</div>
          </Container>
        </section>
      );
    case "faqs":
      return (
        <section key={index} className="py-8">
          <Container className="max-w-3xl">
            <h2 className="text-3xl font-extrabold text-[#071127]">{section.heading}</h2>
            <div className="mt-5 grid gap-3">{section.items.map((item) => <details key={item.question} className="rounded-2xl border border-[#E4EAF0] p-5"><summary className="cursor-pointer font-bold text-[#071127]">{item.question}</summary><p className="mt-3 leading-7 text-[#586575]">{item.answer}</p></details>)}</div>
          </Container>
        </section>
      );
    case "relatedLinks":
      return (
        <section key={index} className="py-8">
          <Container className="max-w-3xl rounded-2xl bg-[#F4F7FA] p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-[#071127]">{section.heading}</h2>
            <div className="mt-4 grid gap-2">{section.links.map((link) => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center gap-2 font-bold text-[#1974E2]">{link.label} <ArrowRight size={15} /></Link>)}</div>
          </Container>
        </section>
      );
    case "serviceCards": {
      const items = [...services, ...diagnostics].filter((item) => item.published && section.slugs.includes(item.slug));
      return items.length ? (
        <section key={index} className="py-8">
          <Container className="max-w-3xl">
            <h2 className="text-3xl font-extrabold text-[#071127]">{section.heading}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">{items.map((item) => <Link key={item.slug} href={`/${item.category === "diagnostics" ? "diagnostics" : "services"}/${item.slug}`} className="rounded-xl border border-[#1974E2]/20 p-4 font-bold text-[#1974E2] hover:bg-[#EAF3FF]">{item.name}</Link>)}</div>
          </Container>
        </section>
      ) : null;
    }
    case "gallery": {
      const publishedMedia = await getPublishedMedia(section.category);
      const media = (section.mediaIds !== undefined
        ? section.mediaIds.map((id) => publishedMedia.find((asset) => asset.id === id)).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
        : publishedMedia
      ).slice(0, 4);
      return media.length ? (
        <section key={index} className="py-8">
          <Container className="max-w-5xl">
            <h2 className="text-3xl font-extrabold text-[#071127]">{section.heading}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">{media.map((asset) => <div key={asset.id} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#E4EAF0]"><Image src={asset.url} alt={asset.alt} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" /></div>)}</div>
          </Container>
        </section>
      ) : null;
    }
    case "cta":
      return (
        <section key={index} className="py-9">
          <Container className="max-w-4xl">
            <div className="rounded-3xl bg-[#071127] p-8 text-white sm:p-10">
              <h2 className="text-3xl font-extrabold sm:text-4xl">{section.heading}</h2>
              <p className="mt-3 max-w-2xl leading-7 text-[#C6D2DF]">{section.body}</p>
              <ButtonLink className="mt-6" href={section.href}>{section.label}</ButtonLink>
            </div>
          </Container>
        </section>
      );
    default:
      return null;
  }
}

function renderArticleBody(paragraphs: string[]) {
  const lines = paragraphs.join("\n\n").split(/\r?\n/);
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index]?.trim() || "";
    if (!line) { index += 1; continue; }

    if (line.startsWith("## ")) {
      blocks.push(<h2 key={index} className="pt-4 text-3xl font-extrabold text-[#071127] sm:text-4xl">{renderInlineMarkup(line.slice(3))}</h2>);
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={index} className="pt-3 text-2xl font-bold text-[#071127]">{renderInlineMarkup(line.slice(4))}</h3>);
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push(<blockquote key={index} className="border-l-4 border-[#1974E2] bg-[#F4F7FA] px-5 py-4 font-semibold text-[#334155]">{renderInlineMarkup(line.slice(2))}</blockquote>);
      index += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while ((lines[index]?.trim() || "").startsWith("- ")) { items.push((lines[index]?.trim() || "").slice(2)); index += 1; }
      blocks.push(<ul key={`ul-${index}`} className="list-disc space-y-2 pl-6">{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInlineMarkup(item)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (/^\d+\.\s/.test(lines[index]?.trim() || "")) { items.push((lines[index]?.trim() || "").replace(/^\d+\.\s/, "")); index += 1; }
      blocks.push(<ol key={`ol-${index}`} className="list-decimal space-y-2 pl-6">{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInlineMarkup(item)}</li>)}</ol>);
      continue;
    }

    blocks.push(<p key={index}>{renderInlineMarkup(line)}</p>);
    index += 1;
  }

  return blocks;
}

function renderInlineMarkup(value: string) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((?:\/|https?:\/\/)[^)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(value.slice(cursor, start));
    const token = match[0];
    if (token.startsWith("**")) nodes.push(<strong key={start}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) nodes.push(<em key={start}>{token.slice(1, -1)}</em>);
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = link?.[1];
      const href = link?.[2];
      if (label && href) nodes.push(<Link key={start} href={href} className="font-semibold text-[#1974E2] underline underline-offset-4">{label}</Link>);
    }
    cursor = start + token.length;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}
