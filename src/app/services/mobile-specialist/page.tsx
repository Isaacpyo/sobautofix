import { Building2, CheckCircle2, MapPin, Route, Smartphone, Wrench } from "lucide-react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { PageHero } from "@/components/marketing/page-hero";
import { ServiceCard } from "@/components/marketing/service-card";
import { CategoryFaqs, ServiceCategoryNavigation, type CategoryFaq } from "@/components/services/category-hub";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { contactLinks } from "@/config/site";
import { createMetadata, serviceJsonLd } from "@/lib/seo";

export const metadata = createMetadata(
  "Mobile & Specialist Vehicle Services Doncaster",
  "Mobile diagnostics, selected mobile repairs, vehicle recovery, inspections and fleet support across Doncaster.",
  "/services/mobile-specialist",
);

const specialistServices = [
  { title: "Mobile Mechanic", body: "Diagnostics and suitable repair work at the vehicle's location, with a workshop or recovery recommendation when that is the better route.", href: "/mobile-mechanic", icon: "repair" as const },
  { title: "Vehicle Recovery", body: "Request recovery availability with accurate vehicle, location and condition information so the appropriate option can be reviewed.", href: "/vehicle-recovery", icon: "repair" as const },
  { title: "Pre-Purchase Inspection", body: "A visual mechanical assessment and diagnostic health review to provide more information before a vehicle purchase decision.", href: "/vehicle-inspections", icon: "inspection" as const },
  { title: "Fleet Servicing", body: "Discuss diagnostics, preventative maintenance and repair coordination for the vehicles your organisation relies on.", href: "/fleet", icon: "service" as const },
];

const mobileSuitable = ["Initial diagnostics", "Warning-light investigation", "Electrical fault investigation", "Battery, starting and charging assessment", "Selected repairs", "Pre-purchase inspections"];
const workshopSuitable = ["Repairs requiring lifting equipment", "More extensive mechanical work", "Work requiring controlled workshop equipment", "Complex repairs or extended testing"];

const mobileFaqs: CategoryFaq[] = [
  { question: "Can every repair be completed through a mobile appointment?", answer: "No. Mobile work is limited to tasks that can be carried out safely and effectively at the location. Some vehicles need workshop equipment, more extensive access or recovery." },
  { question: "Which areas do mobile appointments cover?", answer: "SOB Autofix is based in Doncaster and reviews requests across surrounding areas. Availability depends on the service, postcode and current appointment capacity." },
  { question: "Is vehicle recovery an immediate-response service?", answer: "No fixed attendance time is promised online. Recovery requests are reviewed according to location, vehicle condition and current availability." },
  { question: "Can a pre-purchase inspection guarantee a fault-free vehicle?", answer: "No. An inspection provides observations based on the vehicle, access and condition at the time. It can reduce uncertainty but cannot guarantee that no future fault will develop." },
];

export default function MobileSpecialistPage() {
  return (
    <>
      <JsonLd value={serviceJsonLd("Mobile & Specialist Vehicle Services", "Mobile automotive support, inspections, recovery and fleet services in Doncaster.", "/services/mobile-specialist")} />
      <PageHero
        eyebrow="Mobile & specialist"
        title="Mobile & Specialist Vehicle Services in Doncaster"
        body="Mobile diagnostics, selected mobile repair work, recovery requests, vehicle inspections and fleet support—with a clear workshop recommendation when the job needs different equipment or access."
        actions={<><ButtonLink href="/mobile-mechanic">Request Mobile Assistance</ButtonLink><ButtonLink href="/get-a-quote" variant="secondary">Get a Quote</ButtonLink></>}
      >
        <VehicleJourney compact source="mobile-specialist-hub" />
      </PageHero>

      <section className="py-7"><Container><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "Mobile & Specialist", href: "/services/mobile-specialist" }]} /></Container></section>
      <ServiceCategoryNavigation current="mobile" />

      <section className="py-20 sm:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div><Eyebrow>Choose the right kind of support</Eyebrow><h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">At your location, at the workshop or through a specialist route.</h2></div>
            <p className="text-lg leading-8 text-[#586575]">Start with the vehicle, location and problem. SOB Autofix will review which service fits and whether mobile attendance is appropriate rather than implying every job can be completed roadside.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {specialistServices.map((item, index) => <ServiceCard key={item.href} {...item} dark={index === 0 || index === 3} />)}
          </div>
        </Container>
      </section>

      <section className="bg-[#F4F7FA] py-20 sm:py-24">
        <Container>
          <div className="max-w-3xl"><Eyebrow>Mobile or workshop?</Eyebrow><h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">The safest and most useful setting depends on the work.</h2><p className="mt-4 text-lg leading-8 text-[#586575]">These examples are a guide, not a guarantee for a particular vehicle. The route is confirmed after the request is reviewed.</p></div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <ComparisonPanel icon={Smartphone} title="Mobile may be suitable for" items={mobileSuitable} />
            <ComparisonPanel icon={Building2} title="Workshop may be more appropriate for" items={workshopSuitable} workshop />
          </div>
        </Container>
      </section>

      <section className="bg-[#071127] py-20 text-white sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div>
            <MapPin className="text-[#67B9FF]" size={30} />
            <Eyebrow className="mt-7 text-[#67B9FF]">Doncaster mobile coverage</Eyebrow>
            <h2 className="text-4xl font-extrabold sm:text-5xl">Share the postcode so availability can be checked.</h2>
            <p className="mt-5 leading-7 text-[#B7C5D7]">Mobile and recovery availability varies by the service, location and current capacity. SOB Autofix serves Doncaster and reviews suitable requests from surrounding South Yorkshire areas without promising coverage or response times before the details are confirmed.</p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {[{ icon: Smartphone, title: "Send the vehicle details", body: "Include the registration and known vehicle information." }, { icon: MapPin, title: "Share the location", body: "Provide the current postcode and relevant access details." }, { icon: Wrench, title: "Describe the problem", body: "Explain the symptoms and whether the vehicle can be driven." }, { icon: Route, title: "Confirm the route", body: "Mobile, workshop, inspection or recovery options are reviewed." }].map(({ icon: Icon, title, body }, index) => <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-center justify-between"><Icon className="text-[#67B9FF]" size={22} /><span className="text-xs font-black text-[#67B9FF]">0{index + 1}</span></div><h3 className="mt-7 text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#B7C5D7]">{body}</p></li>)}
          </ol>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1"><Eyebrow>Related categories</Eyebrow><h2 className="text-4xl font-extrabold text-[#071127]">Connect the support to the underlying need.</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2"><ButtonLink href="/diagnostics" variant="outline" className="justify-between">Explore Diagnostics</ButtonLink><ButtonLink href="/services/repairs-maintenance" variant="outline" className="justify-between">Repairs & Maintenance</ButtonLink></div>
        </Container>
      </section>

      <CategoryFaqs faqs={mobileFaqs} eyebrow="Mobile and specialist questions" />

      <section className="bg-[#071127] py-16 text-white sm:py-20">
        <Container className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div><Eyebrow className="text-[#67B9FF]">Need us to come to you, recover or inspect a vehicle?</Eyebrow><h2 className="max-w-3xl text-4xl font-extrabold sm:text-5xl">Tell us what you need and where the vehicle is.</h2></div>
          <div className="flex max-w-xl flex-wrap gap-3"><ButtonLink href="/mobile-mechanic">Request Mobile Assistance</ButtonLink><ButtonLink href="/get-a-quote" variant="secondary">Get a Quote</ButtonLink><ButtonLink href={contactLinks.phone} variant="secondary">Call</ButtonLink><ButtonLink href={contactLinks.whatsapp} variant="secondary" target="_blank" rel="noreferrer">WhatsApp</ButtonLink></div>
        </Container>
      </section>
    </>
  );
}

function ComparisonPanel({ icon: Icon, title, items, workshop = false }: { icon: typeof Smartphone; title: string; items: string[]; workshop?: boolean }) {
  return <article className={workshop ? "rounded-3xl border border-[#D7E0E9] bg-white p-7 sm:p-9" : "rounded-3xl bg-[#071127] p-7 text-white sm:p-9"}><Icon className={workshop ? "text-[#1974E2]" : "text-[#67B9FF]"} size={28} /><h3 className={`mt-7 text-3xl font-bold ${workshop ? "text-[#071127]" : ""}`}>{title}</h3><ul className={`mt-6 grid gap-3 ${workshop ? "text-[#586575]" : "text-[#DCE6F2]"}`}>{items.map((item) => <li key={item} className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 shrink-0 ${workshop ? "text-[#1974E2]" : "text-[#67B9FF]"}`} size={19} />{item}</li>)}</ul></article>;
}
