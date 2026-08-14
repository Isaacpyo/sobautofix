"use client";

import { Mail, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ArticleCard } from "./article-card";
import type { NewsArticle } from "@/lib/news/article";

export function NewsExplorer({
  articles,
  email,
}: {
  articles: NewsArticle[];
  email: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const categories = [
    "All",
    ...Array.from(new Set(articles.map((article) => article.article.category))),
  ];
  const filtered = useMemo(
    () =>
      articles.filter((article) => {
        const matchesCategory =
          category === "All" || article.article.category === category;
        const text =
          `${article.title} ${article.excerpt} ${article.article.author} ${article.article.category}`.toLowerCase();
        return matchesCategory && text.includes(query.trim().toLowerCase());
      }),
    [articles, category, query],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleArticles = filtered.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );
  const goToPage = (nextPage: number) => {
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
    requestAnimationFrame(() => {
      document
        .getElementById("latest-articles-heading")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4 border-y border-[#DCE5EE] py-5 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#667586]"
            aria-hidden="true"
          />
          <span className="sr-only">Search articles</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search articles"
            className="min-h-12 w-full rounded-xl border border-[#D7E0E9] bg-white pr-4 pl-11 text-sm text-[#071127] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/10"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item);
                setPage(1);
              }}
              aria-pressed={category === item}
              className={`min-h-10 rounded-full px-3 text-sm font-bold transition ${category === item ? "bg-[#1974E2] text-white" : "border border-[#D7E0E9] bg-white text-[#334155] hover:border-[#1974E2] hover:text-[#1974E2]"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-5 text-sm text-[#667586]">
        {filtered.length} {filtered.length === 1 ? "article" : "articles"} found
      </p>
      {filtered.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-[#D7E0E9] bg-white p-8 text-center">
          <h3 className="text-xl font-bold text-[#071127]">
            No matching articles
          </h3>
          <p className="mt-2 text-sm text-[#586575]">
            Try another search term or category.
          </p>
        </div>
      )}
      {filtered.length > pageSize && (
        <nav
          className="mt-8 flex items-center justify-center gap-4"
          aria-label="Article pagination"
        >
          <button
            type="button"
            onClick={() => goToPage(activePage - 1)}
            disabled={activePage === 1}
            className="min-h-11 rounded-lg border border-[#D7E0E9] bg-white px-4 text-sm font-bold text-[#071127] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Previous
          </button>
          <span className="text-sm font-bold text-[#586575]">
            Page {activePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(activePage + 1)}
            disabled={activePage === totalPages}
            className="min-h-11 rounded-lg border border-[#D7E0E9] bg-white px-4 text-sm font-bold text-[#071127] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </nav>
      )}
      <section className="mt-12 rounded-3xl bg-[#071127] p-7 text-white sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[.16em] text-[#67B9FF] uppercase">
              Workshop updates
            </p>
            <h2 className="mt-2 text-3xl font-extrabold">
              Get practical vehicle advice by email.
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-[#C6D2DF]">
              Request occasional diagnostic insights, maintenance guidance and
              SOB Autofix updates.
            </p>
          </div>
          <a
            href={`mailto:${email}?subject=${encodeURIComponent("Newsletter sign-up")}&body=${encodeURIComponent("Please add me to SOB Autofix newsletter updates.\n\nMy email address: ")}`}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1974E2] px-5 font-bold text-white transition hover:bg-[#145CAD]"
          >
            <Mail size={18} aria-hidden="true" />
            Request updates
          </a>
        </div>
      </section>
    </>
  );
}
