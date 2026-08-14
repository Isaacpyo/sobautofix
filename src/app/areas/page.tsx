import { HomeCoverageMap } from "@/components/marketing/home-coverage-map";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionIntro } from "@/components/marketing/experience";
import { Container } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Areas Covered from Doncaster", "SOB Autofix provides workshop and mobile automotive services across Doncaster and South Yorkshire.", "/areas");

export default function AreasPage() {
  return (
    <>
      <PageHero eyebrow="Areas covered" title="Workshop and mobile automotive support across Doncaster and South Yorkshire." body="Select a location to explore the coverage area, then share the postcode and vehicle details so suitability can be confirmed." />
      <section className="py-20">
        <Container>
          <SectionIntro eyebrow="Service coverage" title="Choose your area" body="Use the map or select a location below. Availability depends on the service, vehicle condition and exact postcode." />
          <HomeCoverageMap expanded />
          <p className="mt-8 max-w-3xl leading-7 text-[#586575]">Doncaster is our primary service area. We can review mobile requests in surrounding South Yorkshire locations where the work, vehicle condition and access are suitable.</p>
        </Container>
      </section>
    </>
  );
}
