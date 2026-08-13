import { ArrowRight, Newspaper } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatArticleDate, type NewsArticle } from "@/lib/news/article";
import { cn } from "@/lib/utils";

export function ArticleCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  return (
    <article className={cn("premium-card group overflow-hidden rounded-[1.75rem_.35rem_1.75rem_.35rem] border border-[#E4EAF0] bg-white", featured && "lg:grid lg:grid-cols-[1.08fr_.92fr]")} data-reveal>
      <Link href={`/news/${article.slug}`} className={cn("relative block overflow-hidden bg-[#071127]", featured ? "min-h-64 lg:min-h-[23rem]" : "aspect-[16/10]")} aria-label={`Read ${article.title}`}>
        {article.cover ? (
          <Image
            src={article.cover.url}
            alt={article.cover.alt}
            fill
            sizes={featured ? "(max-width: 1024px) 100vw, 55vw" : "(max-width: 768px) 100vw, 33vw"}
            className="object-cover transition duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <span className="hero-grid absolute inset-0 grid place-items-center" aria-hidden="true">
            <Newspaper size={54} className="text-[#67B9FF]" />
          </span>
        )}
      </Link>
      <div className={featured ? "flex flex-col justify-center p-7 sm:p-9" : "p-6"}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-[#667586]">
          <span className="text-[#1974E2]">{article.article.category}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
          <span aria-hidden="true">·</span>
          <span>{article.readingMinutes} min read</span>
        </div>
        <h2 className={cn("mt-3 font-extrabold text-[#071127]", featured ? "text-3xl sm:text-4xl" : "text-2xl")}>
          <Link href={`/news/${article.slug}`} className="hover:text-[#1974E2]">{article.title}</Link>
        </h2>
        <p className="mt-3 line-clamp-3 leading-7 text-[#586575]">{article.excerpt}</p>
        <Link href={`/news/${article.slug}`} className="mt-6 inline-flex min-h-10 items-center gap-2 font-bold text-[#1974E2] [&_svg]:transition-transform group-hover:[&_svg]:translate-x-1">
          Read article <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
