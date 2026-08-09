import { EnquiryForm } from "@/components/forms/enquiry-form";
import { PageHero } from "@/components/marketing/page-hero";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { Container } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Request a Vehicle Repair Estimate", "Share your vehicle, service requirement and symptoms to request an estimate from SOB Autofix in Doncaster.", "/get-a-quote");

export default function QuotePage() {
  return <><PageHero eyebrow="Request an estimate" title="Start with the vehicle and the problem." body="An online request helps us understand the likely scope. It is not a guaranteed instant price."><VehicleJourney compact source="quote" /></PageHero><section className="bg-[#F4F7FA] py-20"><Container className="max-w-3xl"><EnquiryForm type="repair" title="Request an estimate" /></Container></section></>;
}
