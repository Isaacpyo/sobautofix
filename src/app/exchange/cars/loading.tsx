import { Container } from "@/components/exchange/ui";

export default function CatalogueLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading cars</span>
      <section className="border-b border-[#E3E8EF] bg-[#F3F5F8]">
        <Container className="py-7 sm:py-10">
          <div className="h-12 w-72 max-w-full animate-pulse rounded-xl bg-[#E3E8EF]" />
          <div className="mt-4 h-5 w-[32rem] max-w-full animate-pulse rounded bg-[#E3E8EF]" />
        </Container>
      </section>
      <Container className="py-6 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden h-[520px] animate-pulse rounded-2xl bg-[#F3F5F8] lg:block" />
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="overflow-hidden rounded-2xl border border-[#E3E8EF]">
                <div className="aspect-[4/3] animate-pulse bg-[#F3F5F8]" />
                <div className="space-y-3 p-5">
                  <div className="h-6 w-2/3 animate-pulse rounded bg-[#E3E8EF]" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[#F3F5F8]" />
                  <div className="h-8 w-1/3 animate-pulse rounded bg-[#E3E8EF]" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </div>
  );
}
