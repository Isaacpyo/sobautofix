import { Newspaper } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ArticleCard } from "@/components/news/article-card";
import { NewsExplorer } from "@/components/news/news-explorer";
import { GoogleReviewsSection } from "@/components/reviews/google-reviews-section";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
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
      <PageHero
        title="Automotive news, advice and guides."
        body="Practical vehicle advice, diagnostic insights and updates from the SOB Autofix team in Doncaster."
        cta={false}
        compact
        showTrustFacts={false}
      />
      {featured ? (
        <>
          <section className="py-8 sm:py-10 lg:py-12" aria-label="Featured article">
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
                <NewsExplorer articles={latest} email={siteConfig.email} />
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
      <GoogleReviewsSection />
    </>
  );
}
