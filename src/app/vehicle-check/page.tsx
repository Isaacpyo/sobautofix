import { PageHero } from "@/components/marketing/page-hero";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { Container, Eyebrow } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Identify Your Vehicle", "Enter a UK vehicle registration to carry the vehicle into a diagnostics, booking or quote journey with SOB Autofix.", "/vehicle-check");

export default function VehicleCheckPage() {
  return <><PageHero eyebrow="Check your vehicle" title="Identify the vehicle before the long form." body="Confirm the registration details, choose what is happening and continue to the most relevant service." cta={false} /><section className="diagnostic-panel py-20" data-motion="off"><Container className="max-w-4xl"><div className="rounded-[2rem_.4rem_2rem_.4rem] border border-[#1974E2]/25 bg-white p-1 shadow-2xl"><VehicleJourney source="vehicle-check" /></div><div className="mt-10 border-l-2 border-[#1974E2] bg-white/5 p-6"><Eyebrow className="text-[#67B9FF]">Privacy by design</Eyebrow><h2 className="text-2xl font-bold text-white">Vehicle context stays in this tab.</h2><p className="mt-3 leading-7 text-[#C6D2DF]">The registration is not placed in the page address or sent to analytics. Anonymous lookups are not retained as customer records.</p></div></Container></section></>;
}
