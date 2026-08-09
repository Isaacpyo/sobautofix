import { ArrowRight, CircuitBoard, MapPin, Wrench } from "lucide-react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { PageHero } from "@/components/marketing/page-hero";
import { ServiceCategoryNavigation } from "@/components/services/category-hub";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { createMetadata, serviceJsonLd } from "@/lib/seo";

export const metadata = createMetadata(
  "Vehicle Services in Doncaster",
  "Explore professional diagnostics, vehicle repairs, servicing, mobile mechanic support, inspections, recovery and fleet work in Doncaster.",
  "/services",
);

const categorySchema = [
  serviceJsonLd("Vehicle Diagnostics & Fault Finding", "Professional diagnostics and systematic fault investigation.", "/diagnostics"),
  serviceJsonLd("Vehicle Repairs & Maintenance", "Vehicle servicing and evidence-led repair work.", "/services/repairs-maintenance"),
  serviceJsonLd("Mobile & Specialist Vehicle Services", "Mobile support, recovery, inspections and fleet services.", "/services/mobile-specialist"),
];

export default function ServicesPage() {
  return (
    <>
      <JsonLd value={categorySchema} />
      <PageHero
        eyebrow="SOB Autofix services"
        title="Vehicle Services in Doncaster"
        body="Start with the vehicle and what it is doing. Explore professional diagnostics, practical repair and maintenance, or mobile and specialist support—then choose the most useful next step."
      >
        <VehicleJourney compact source="services-hub" />
      </PageHero>

      <section className="py-7"><Container><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }]} /></Container></section>
      <ServiceCategoryNavigation />

      <section className="py-20 sm:py-24">
        <Container>
          <div className="max-w-4xl"><Eyebrow>Three ways to find the right service</Eyebrow><h2 className="text-balance text-4xl font-extrabold text-[#071127] sm:text-5xl">Choose a category, not a guessed component.</h2><p className="mt-5 text-lg leading-8 text-[#586575]">Each hub explains the type of work, the individual services within it and when another category may be a better fit. Dedicated service pages remain focused on the specific assessment or work.</p></div>

          <div className="mt-12 grid gap-6 lg:grid-cols-12">
            <CategoryPanel
              className="diagnostic-panel text-white lg:col-span-7"
              icon={CircuitBoard}
              eyebrow="7 diagnostic services"
              title="Diagnostics"
              body="Warning lights, electrical faults, control modules and starting or charging concerns need more than a fault-code printout. Explore systematic testing that starts with the symptoms."
              href="/diagnostics"
              action="Explore Diagnostics"
              links={["Vehicle Diagnostics", "Electrical Fault Finding", "Warning-Light Investigation"]}
              dark
            />
            <CategoryPanel
              className="border border-[#E4EAF0] bg-[#F4F7FA] lg:col-span-5"
              icon={Wrench}
              eyebrow="3 published core services"
              title="Repairs & Maintenance"
              body="Routine servicing and fault-led engine or brake repairs, with other verified capabilities reviewed through the quote journey."
              href="/services/repairs-maintenance"
              action="Explore Repairs & Maintenance"
              links={["Vehicle Servicing", "Engine Repairs", "Brake Repairs"]}
            />
            <CategoryPanel
              className="border border-[#1974E2]/25 bg-white lg:col-span-12"
              icon={MapPin}
              eyebrow="4 support routes"
              title="Mobile & Specialist"
              body="Mobile mechanic appointments, vehicle recovery requests, pre-purchase inspections and fleet support—plus clear guidance when workshop equipment or a specialist route is more appropriate."
              href="/services/mobile-specialist"
              action="Explore Mobile & Specialist"
              links={["Mobile Mechanic", "Vehicle Recovery", "Pre-Purchase Inspection", "Fleet Servicing"]}
              horizontal
            />
          </div>
        </Container>
      </section>

      <section className="bg-[#F4F7FA] py-20 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div><Eyebrow>Not sure where to begin?</Eyebrow><h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">Describe the symptom and let the evidence guide the route.</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[{ title: "Warning light or electrical issue", body: "Start with Diagnostics so the relevant systems can be assessed.", href: "/diagnostics" }, { title: "Known maintenance or repair need", body: "Review Repairs & Maintenance for servicing and confirmed mechanical work.", href: "/services/repairs-maintenance" }, { title: "Vehicle cannot reach the workshop", body: "Review mobile suitability or request recovery availability.", href: "/services/mobile-specialist" }, { title: "Still uncertain", body: "Use the quote form with the registration and symptoms. A category can be confirmed after review.", href: "/get-a-quote" }].map((item) => <Link key={item.title} href={item.href} className="group rounded-2xl border border-[#E4EAF0] bg-white p-5 transition hover:border-[#1974E2]/50"><h3 className="flex items-start justify-between gap-3 text-xl font-bold text-[#071127]">{item.title}<ArrowRight className="mt-1 shrink-0 text-[#1974E2] transition group-hover:translate-x-1" size={17} /></h3><p className="mt-3 text-sm leading-6 text-[#586575]">{item.body}</p></Link>)}
          </div>
        </Container>
      </section>

      <section className="bg-[#071127] py-16 text-white sm:py-20">
        <Container className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div><Eyebrow className="text-[#67B9FF]">Tell us about the vehicle</Eyebrow><h2 className="max-w-3xl text-4xl font-extrabold sm:text-5xl">Start with useful context, then plan the appointment.</h2></div>
          <div className="flex flex-wrap gap-3"><ButtonLink href="/get-a-quote">Get a Quote</ButtonLink><ButtonLink href="/book" variant="secondary">Book Appointment</ButtonLink></div>
        </Container>
      </section>
    </>
  );
}

function CategoryPanel({ className, icon: Icon, eyebrow, title, body, href, action, links, dark = false, horizontal = false }: { className: string; icon: typeof Wrench; eyebrow: string; title: string; body: string; href: string; action: string; links: string[]; dark?: boolean; horizontal?: boolean }) {
  return <article className={`rounded-3xl p-7 sm:p-9 ${className} ${horizontal ? "lg:grid lg:grid-cols-[1fr_.85fr] lg:gap-12" : ""}`}><div><Icon className={dark ? "text-[#67B9FF]" : "text-[#1974E2]"} size={28} /><p className={`mt-7 text-xs font-extrabold tracking-[0.16em] uppercase ${dark ? "text-[#67B9FF]" : "text-[#145CAD]"}`}>{eyebrow}</p><h3 className="mt-2 text-4xl font-extrabold">{title}</h3><p className={`mt-4 leading-7 ${dark ? "text-[#B7C5D7]" : "text-[#586575]"}`}>{body}</p></div><div className={horizontal ? "mt-8 lg:mt-0 lg:self-end" : "mt-8"}><ul className={`grid gap-2 text-sm font-semibold ${dark ? "text-[#DCE6F2]" : "text-[#071127]"}`}>{links.map((item) => <li key={item}>— {item}</li>)}</ul><Link href={href} className={`mt-7 inline-flex min-h-11 items-center gap-2 font-bold ${dark ? "text-[#67B9FF] hover:text-white" : "text-[#1974E2] hover:text-[#1446A5]"}`}>{action}<ArrowRight size={16} /></Link></div></article>;
}
