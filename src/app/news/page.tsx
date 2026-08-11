import { Newspaper } from "lucide-react";
import { ArticleCard } from "@/components/news/article-card";
import { Container } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";
import { getPublishedArticles } from "@/lib/news/repository";

export const metadata = createMetadata(
  "Automotive News, Advice & Guides in Doncaster",
  "Practical automotive advice, diagnostic insights, vehicle guides and updates from SOB Autofix in Doncaster.",
  "/news",
);

export default async function NewsPage() {
  const articles = await getPublishedArticles();
  const featured = articles.find((article) => article.article.featured) || articles[0];
  const latest = articles.filter((article) => article.id !== featured?.id);

  return (
    <>
      <section className="hero-grid py-14 text-white sm:py-20 lg:py-24">
        <Container>
          <p className="text-xs font-extrabold tracking-[0.17em] text-[#67B9FF] uppercase">From the workshop</p>
          <h1 className="text-balance mt-4 text-6xl leading-[0.9] font-extrabold sm:text-7xl lg:text-8xl">News & Blog</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#C6D2DF]">Practical vehicle advice, diagnostic insight and considered updates from SOB Autofix.</p>
        </Container>
      </section>

      {featured ? (
        <>
          <section className="py-14 sm:py-20" aria-labelledby="featured-article-heading">
            <Container>
              <p className="text-xs font-extrabold tracking-[0.16em] text-[#1974E2] uppercase">Featured article</p>
              <h2 id="featured-article-heading" className="sr-only">Featured article</h2>
              <div className="mt-5"><ArticleCard article={featured} featured /></div>
            </Container>
          </section>
          {latest.length > 0 && (
            <section className="border-t border-[#E4EAF0] bg-[#F4F7FA] py-14 sm:py-20" aria-labelledby="latest-articles-heading">
              <Container>
                <h2 id="latest-articles-heading" className="text-4xl font-extrabold text-[#071127] sm:text-5xl">Latest articles</h2>
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{latest.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
              </Container>
            </section>
          )}
        </>
      ) : (
        <section className="py-20 sm:py-28">
          <Container className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><Newspaper size={30} aria-hidden="true" /></span>
            <h2 className="mt-5 text-3xl font-extrabold text-[#071127]">News & insights are on the way.</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#586575]">We’ll be sharing practical vehicle advice, diagnostic insights and updates from SOB Autofix.</p>
          </Container>
        </section>
      )}
    </>
  );
}
