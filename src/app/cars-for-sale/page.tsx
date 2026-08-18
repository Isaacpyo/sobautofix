import { PageHero } from "@/components/marketing/page-hero";
import { SectionIntro } from "@/components/marketing/experience";
import { InventoryGrid } from "@/components/sales/inventory-grid";
import { Container } from "@/components/ui/container";
import { getPublicSaleVehicles } from "@/lib/sales/repository";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Used Cars for Sale in Doncaster", "Browse genuine used vehicle listings from SOB Autofix in Doncaster. Finance options may be available on selected vehicles.", "/cars-for-sale");

export default async function CarsForSalePage() {
  const vehicles = await getPublicSaleVehicles();

  return (
    <>
      <PageHero title="Used cars for sale in Doncaster." cta={false} compact showTrustFacts={false} />
      <section className="py-8 sm:py-10 lg:py-12">
        <Container>
          <SectionIntro className="mb-8" eyebrow="Current stock" title="Available vehicles" />
          <InventoryGrid vehicles={vehicles} />
        </Container>
      </section>
      <section className="bg-[#071127] py-16 text-white">
        <Container>
          <h2 className="text-3xl font-bold">Finance information</h2>
          <p className="mt-3 max-w-2xl leading-7 text-[#C6D2DF]">Finance options may be available on selected vehicles. Contact us for details. SOB Autofix is not presented as the lender.</p>
        </Container>
      </section>
    </>
  );
}
