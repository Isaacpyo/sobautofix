import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";

export function ServiceRegistrationCta({ source }: { source: string }) {
  return (
    <section className="border-t border-[#E4EAF0] bg-[#F4F7FA] py-14 sm:py-20">
      <Container className="max-w-7xl">
        <div className="overflow-hidden rounded-3xl border border-[#D6E2F0] bg-white shadow-[0_20px_60px_rgba(7,17,39,0.08)] lg:grid lg:grid-cols-[.9fr_1.1fr]">
          <div className="flex flex-col border-b border-[#E4EAF0] bg-[#F8FBFF] p-8 sm:p-12 lg:border-r lg:border-b-0 lg:p-14">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#1974E2]">Start with your vehicle</p>
            <h2 className="mt-3 max-w-lg text-balance text-4xl font-extrabold tracking-tight text-[#071127] sm:text-5xl">A clearer route to the right service.</h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-[#586575]">Enter your registration once, confirm the vehicle, then carry those details into a booking or quote request.</p>
          </div>
          <div className="p-5 sm:p-8 lg:p-12">
            <VehicleJourney source={`${source}-footer`} heading="Find your vehicle" />
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/get-a-quote" variant="outline">Get a Quote</ButtonLink>
              <ButtonLink href="/book">Book Appointment</ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
