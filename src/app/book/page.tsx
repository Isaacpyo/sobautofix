import { CalendlyEmbed } from "@/components/booking/calendly-embed";
import { PageHero } from "@/components/marketing/page-hero";
import { VehicleSummary } from "@/components/vehicle/vehicle-summary";
import { Container } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Book an Appointment", "Book a diagnostics, repair, service or inspection appointment with SOB Autofix in Doncaster.", "/book");

export default function BookPage() {
  return <><PageHero eyebrow="Online booking" title="Book your appointment" body="Your selected vehicle, problem and service stay with this tab and are passed into the booking flow where supported." cta={false} /><section className="py-12 sm:py-16"><Container className="max-w-5xl"><div className="mb-7"><VehicleSummary /></div><CalendlyEmbed /><p className="mt-5 text-center text-sm text-[#667586]">Calendar availability is separate from the business’s published opening hours.</p></Container></section></>;
}
