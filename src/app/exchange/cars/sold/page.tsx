import type { Metadata } from "next";
import { RememberCatalogueUrl } from "@/components/exchange/catalogue-filters";
import { ButtonLink, Container, Notice } from "@/components/exchange/ui";
import { VehicleCard } from "@/components/exchange/vehicle-card";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getRecentlySoldStock } from "@/lib/exchange/public/stock";

export async function generateMetadata(): Promise<Metadata> {
  return exchangeMetadata({ title: "Recently sold cars", description: "Cars SOB Autofix has sold in the last 90 days.", path: "/cars/sold", index: false });
}

export default async function SoldCarsPage() {
  const [base, sold] = await Promise.all([getExchangeBase(), getRecentlySoldStock()]);
  const href = (path: string) => exchangeHref(base, path);
  return (
    <>
      <RememberCatalogueUrl />
      <section className="border-b border-[#E3E8EF] bg-[#F3F5F8]">
        <Container className="py-7 sm:py-10">
          <h1 className="text-[40px] leading-none font-bold text-[#0B1220] sm:text-[52px]">Recently sold</h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-7 text-[#344054]">Cars we have sold in the last 90 days, shown for reference. They are no longer available.</p>
        </Container>
      </section>
      <Container className="py-8">
        {sold.unavailable ? (
          <Notice title="This list is temporarily unavailable" role="status">Please try again in a few minutes.</Notice>
        ) : sold.vehicles.length ? (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sold.vehicles.map((vehicle) => <li key={vehicle.id}><VehicleCard vehicle={vehicle} href={href(`/cars/${vehicle.slug}`)} headingLevel="h2" /></li>)}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#C9D3E0] p-8 text-center">
            <p className="text-xl font-semibold text-[#0B1220]">No cars sold in the last 90 days</p>
          </div>
        )}
        <ButtonLink href={href("/cars")} className="mt-8">Browse available cars</ButtonLink>
      </Container>
    </>
  );
}
