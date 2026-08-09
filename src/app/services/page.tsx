import { PageHero } from "@/components/marketing/page-hero";
import { ServiceCard } from "@/components/marketing/service-card";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { Container, Eyebrow } from "@/components/ui/container";
import { services } from "@/config/site";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Vehicle Repairs & Servicing Doncaster", "Vehicle servicing, engine and brake repairs, starting and charging work, and evidence-led repair recommendations in Doncaster.", "/services");

export default function ServicesPage() {
  return <><PageHero eyebrow="Repairs & servicing" title="Repair work starts with a clear understanding of the problem." body="From scheduled servicing to engine, brake, electrical and starting-system work, recommendations are based on vehicle condition and testing."><VehicleJourney compact source="services-hub" /></PageHero><section className="py-20"><Container><Eyebrow>Published services</Eyebrow><h2 className="text-5xl font-extrabold text-[#071127]">Core repair and maintenance</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{services.filter((item) => item.published).map((item) => <ServiceCard key={item.slug} title={item.name} body={item.summary} href={`/services/${item.slug}`} icon={item.category === "servicing" ? "service" : "repair"} />)}</div><div className="mt-14 rounded-3xl bg-[#F4F7FA] p-8"><h2 className="text-3xl font-bold text-[#071127]">Other verified services</h2><p className="mt-3 text-[#586575]">Suspension, steering, exhaust, battery, alternator, starter motor, timing work and air-conditioning electrical diagnostics can be discussed through a quote request. Clutch replacement can be arranged through our specialist repair network.</p></div></Container></section></>;
}
