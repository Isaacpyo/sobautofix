import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";

export function ServiceRegistrationCta({ source }: { source: string }) {
  return (
    <section className="border-t border-[#E4EAF0] bg-[#F4F7FA] py-12 sm:py-16">
      <Container className="max-w-4xl">
        <VehicleJourney source={`${source}-footer`} />
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/get-a-quote" variant="outline">
            Get a Quote
          </ButtonLink>
          <ButtonLink href="/book">Book Appointment</ButtonLink>
        </div>
      </Container>
    </section>
  );
}
