import { ArrowRight, SearchX, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueFilterPanel, CatalogueToolbar, RememberCatalogueUrl } from "@/components/exchange/catalogue-filters";
import { ButtonLink, Container, linkClass, Notice } from "@/components/exchange/ui";
import { VehicleCard } from "@/components/exchange/vehicle-card";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { activeFilterChips, activeFilterCount, buildFilterOptions, catalogueQueryString, filterVehicles, parseCatalogueFilters } from "@/lib/exchange/public/catalogue";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getListedStock } from "@/lib/exchange/public/stock";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const filters = parseCatalogueFilters(await searchParams);
  // Filtered and re-sorted views are the same page for search engines.
  const filtered = activeFilterCount(filters) > 0 || filters.sort !== "newest";
  return exchangeMetadata({
    title: "Used cars for sale in Doncaster",
    description: "Browse used cars from SOB Autofix with condition notes, inspection findings and known faults on every listing.",
    path: "/cars",
    index: filtered ? false : undefined,
  });
}

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [base, params, stock] = await Promise.all([getExchangeBase(), searchParams, getListedStock()]);
  const href = (path: string) => exchangeHref(base, path);
  const path = href("/cars");
  const filters = parseCatalogueFilters(params);
  const results = filterVehicles(stock.vehicles, filters);
  const options = buildFilterOptions(stock.vehicles, filters);
  const chips = activeFilterChips(filters);
  const hasFilters = chips.length > 0;

  return (
    <>
      <RememberCatalogueUrl />
      <section className="border-b border-[#E3E8EF] bg-[#F3F5F8]">
        <Container className="py-7 sm:py-10">
          <h1 className="text-[40px] leading-none font-bold text-[#0B1220] sm:text-[52px]">Used cars for sale</h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-7 text-[#344054]">
            Every listing shows its condition, known faults and inspection notes. Cars marked Reserved are being held for another buyer.
          </p>
        </Container>
      </section>
      <Container className="py-6 sm:py-8">
        {stock.unavailable ? (
          <Notice title="Our stock list is temporarily unavailable" role="status">Please try again in a few minutes, or call us and we will tell you what is available.</Notice>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside aria-label="Filters" className="hidden lg:block">
              <div className="sticky top-[124px] rounded-2xl border border-[#E3E8EF] p-5">
                <h2 className="mb-4 text-[24px] font-bold text-[#0B1220]">Filter cars</h2>
                <CatalogueFilterPanel path={path} filters={filters} options={options} resultCount={results.length} idPrefix="sidebar" />
              </div>
            </aside>
            <div className="min-w-0">
              <div className="flex flex-col gap-4">
                <CatalogueToolbar path={path} filters={filters} options={options} resultCount={results.length} />
                <p className="text-[15px] text-[#344054]" aria-live="polite">
                  <strong className="text-[#0B1220]">{results.length}</strong> {results.length === 1 ? "car" : "cars"}{hasFilters ? " match your filters" : " listed"}
                  {stock.vehicles.length > 0 && <> · <Link href={href("/cars/sold")} className={linkClass}>Recently sold</Link></>}
                </p>
                {hasFilters && (
                  <ul className="flex flex-wrap gap-2" aria-label="Active filters">
                    {chips.map((chip) => (
                      <li key={chip.key}>
                        <Link href={`${path}${chip.query}`} scroll={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#EAF2FD] py-1 pr-3 pl-4 text-sm font-semibold text-[#1462C4] hover:bg-[#D9E8FB]">
                          {chip.label} <X size={16} aria-hidden="true" /><span className="sr-only">Remove filter</span>
                        </Link>
                      </li>
                    ))}
                    <li><Link href={`${path}${catalogueQueryString({ sort: filters.sort })}`} scroll={false} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#344054] underline underline-offset-4">Clear all</Link></li>
                  </ul>
                )}
              </div>
              {results.length ? (
                <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {results.map((vehicle, index) => (
                    <li key={vehicle.id}><VehicleCard vehicle={vehicle} href={href(`/cars/${vehicle.slug}`)} preload={index < 2} headingLevel="h2" /></li>
                  ))}
                </ul>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-[#C9D3E0] bg-white px-6 py-10 text-center">
                  <SearchX size={36} aria-hidden="true" className="mx-auto text-[#5B6575]" />
                  <h2 className="mt-3 text-[28px] font-bold text-[#0B1220]">{hasFilters ? "No cars match these filters" : "No cars are listed right now"}</h2>
                  <p className="mx-auto mt-2 max-w-md leading-7 text-[#5B6575]">
                    {hasFilters
                      ? "Try removing a filter or widening your price or mileage range. Our stock changes regularly."
                      : "New cars are listed once they have been prepared and photographed."}{" "}
                    Tell us what you are looking for and we will let you know if something suitable comes in.
                  </p>
                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    {hasFilters && <ButtonLink href={`${path}${catalogueQueryString({ sort: filters.sort })}`} scroll={false}>Clear filters</ButtonLink>}
                    <ButtonLink href={href("/contact")} variant="secondary">Tell us what you need <ArrowRight size={18} aria-hidden="true" /></ButtonLink>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
