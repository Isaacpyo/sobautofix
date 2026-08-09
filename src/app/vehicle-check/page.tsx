import { PageHero } from "@/components/marketing/page-hero";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { Container, Eyebrow } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Identify Your Vehicle", "Enter a UK vehicle registration to carry the vehicle into a diagnostics, booking or quote journey with SOB Autofix.", "/vehicle-check");

export default function VehicleCheckPage() {
  return <><PageHero eyebrow="Your vehicle" title="Identify the vehicle before the long form." body="Confirm the registration details, choose what is happening and continue to the most relevant service." cta={false} /><section className="py-20"><Container className="max-w-4xl"><VehicleJourney source="vehicle-check" /><div className="mt-10 rounded-2xl bg-[#F4F7FA] p-6"><Eyebrow>Privacy by design</Eyebrow><h2 className="text-2xl font-bold text-[#071127]">Vehicle context stays in this tab.</h2><p className="mt-3 leading-7 text-[#586575]">The registration is not placed in the page address or sent to analytics. Anonymous lookups are not retained as customer records.</p></div></Container></section></>;
}
