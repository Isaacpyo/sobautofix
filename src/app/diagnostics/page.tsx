import { Activity, Binary, Cable, CheckCircle2, ScanLine, SearchCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContextualServiceImage } from "@/components/marketing/contextual-service-image";
import { PageHero } from "@/components/marketing/page-hero";
import { ServiceCard } from "@/components/marketing/service-card";
import { CategoryFaqs, ServiceCategoryNavigation, type CategoryFaq } from "@/components/services/category-hub";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { contactLinks, diagnostics } from "@/config/site";
import { createMetadata, serviceJsonLd } from "@/lib/seo";

export const metadata = createMetadata(
  "Vehicle Diagnostics & Fault Finding Doncaster",
  "Professional vehicle diagnostics, electrical fault finding and warning-light investigation in Doncaster and South Yorkshire.",
  "/diagnostics",
);

const diagnosticFaqs: CategoryFaq[] = [
  { question: "Is a diagnostic scan the same as fault finding?", answer: "A scan provides useful system data and fault codes, but fault finding may also require electrical, mechanical or live-data tests to identify why the vehicle recorded the problem." },
  { question: "Can you investigate an intermittent warning light?", answer: "Yes. Tell us when the warning appears and what the vehicle is doing at the time. Intermittent faults can require testing under the conditions in which the symptom occurs." },
  { question: "Do you diagnose vehicles at the customer's location?", answer: "Many initial diagnostic and electrical checks can be carried out through a mobile appointment. Some faults are better investigated in the workshop, depending on access and equipment required." },
  { question: "Will a diagnostic assessment confirm the repair price?", answer: "The assessment is intended to identify evidence and the sensible next step. A repair estimate can then be prepared when the required work and parts are sufficiently clear." },
];

const process = [
  { icon: Activity, title: "Understand the symptoms", body: "Discuss what has changed, when it happens and any recent work." },
  { icon: ScanLine, title: "Scan and inspect", body: "Review relevant control systems, visible condition and available data." },
  { icon: Cable, title: "Test the system", body: "Carry out focused electrical or mechanical checks where appropriate." },
  { icon: SearchCheck, title: "Isolate the likely cause", body: "Compare the evidence instead of treating a code as a parts instruction." },
  { icon: Binary, title: "Explain the next step", body: "Set out the findings, limitations and recommended route forward." },
];

export default function DiagnosticsPage() {
  const publishedDiagnostics = diagnostics.filter((item) => item.published);

  return (
    <>
      <JsonLd value={serviceJsonLd("Vehicle Diagnostics & Fault Finding", "Professional automotive diagnostics and systematic fault finding in Doncaster and South Yorkshire.", "/diagnostics")} />
      <PageHero
        eyebrow="Professional diagnostics. Not guesswork."
        title="Vehicle Diagnostics & Fault Finding in Doncaster"
        body="Systematic automotive diagnostics for electrical faults, warning lights and vehicle modules across Doncaster and South Yorkshire. We use scans as evidence, then test the relevant system before recommending the next step."
        actions={<><ButtonLink href="/book">Book Diagnostics</ButtonLink><ButtonLink href="/get-a-quote" variant="secondary">Get a Quote</ButtonLink></>}
      >
        <VehicleJourney compact source="diagnostics-hub" />
      </PageHero>

      <section className="py-7"><Container><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "Diagnostics", href: "/diagnostics" }]} /></Container></section>
      <ServiceCategoryNavigation current="diagnostics" />

      <section className="py-20 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <ContextualServiceImage id="diagnostics" className="mb-8 min-h-96" />
            <Eyebrow>Diagnosis before parts</Eyebrow>
            <h2 className="text-balance text-4xl font-extrabold text-[#071127] sm:text-5xl">A fault code is a clue—not a replacement instruction.</h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-[#586575]">
            <p>Modern vehicles share sensors, power supplies and communication networks across multiple control modules. One underlying fault can therefore produce several warnings or stored codes.</p>
            <p>A professional assessment starts with the customer’s symptoms and the vehicle’s data, then uses targeted testing to build a reasoned explanation. That approach can reduce unnecessary parts replacement and gives repair decisions a clearer basis.</p>
          </div>
        </Container>
      </section>

      <section className="bg-[#F4F7FA] py-20 sm:py-24">
        <Container>
          <div className="max-w-3xl">
            <Eyebrow>Diagnostic services</Eyebrow>
            <h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">Choose the closest match to the problem.</h2>
            <p className="mt-4 text-lg leading-8 text-[#586575]">If you are unsure, start with Vehicle Diagnostics or use the registration journey above. The appropriate service can be confirmed after the symptoms are reviewed.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {publishedDiagnostics.map((item) => <ServiceCard key={item.slug} title={item.name} body={item.summary} href={`/diagnostics/${item.slug}`} />)}
          </div>
        </Container>
      </section>

      <section className="diagnostic-panel py-20 text-white sm:py-24">
        <Container>
          <Eyebrow className="text-[#67B9FF]">A flexible diagnostic process</Eyebrow>
          <h2 className="max-w-3xl text-balance text-4xl font-extrabold sm:text-5xl">The investigation follows the evidence.</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[#B7C5D7]">The exact checks depend on the vehicle and fault. These stages describe the approach rather than promising that every assessment follows an identical sequence.</p>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {process.map(({ icon: Icon, title, body }, index) => <li key={title} className="rounded-2xl border border-[#1974E2]/25 bg-white/5 p-5"><div className="flex items-center justify-between"><Icon className="text-[#67B9FF]" size={22} /><span className="text-xs font-black text-[#67B9FF]">0{index + 1}</span></div><h3 className="mt-8 text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#B7C5D7]">{body}</p></li>)}
          </ol>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <Eyebrow>Why diagnosis comes first</Eyebrow>
            <h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">Test the cause before planning the repair.</h2>
            <p className="mt-5 text-lg leading-8 text-[#586575]">A control module records what it has detected. It does not always identify the failed component, and replacing the item named in a code description may leave the original problem unresolved.</p>
          </div>
          <ul className="grid gap-4 rounded-3xl border border-[#D7E0E9] bg-[#F8FAFC] p-6 sm:p-8">
            {["Recommendations based on symptoms and test results", "Electrical and mechanical evidence considered together", "Missing vehicle data is never guessed", "Findings explained before the next stage"].map((item) => <li key={item} className="flex items-start gap-3 font-semibold text-[#071127]"><CheckCircle2 className="mt-0.5 shrink-0 text-[#1974E2]" size={20} />{item}</li>)}
          </ul>
        </Container>
      </section>

      <CategoryFaqs faqs={diagnosticFaqs} />

      <section className="bg-[#071127] py-16 text-white sm:py-20">
        <Container className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div><Eyebrow className="text-[#67B9FF]">Warning light or vehicle fault?</Eyebrow><h2 className="max-w-3xl text-4xl font-extrabold sm:text-5xl">Book a diagnostic assessment with SOB Autofix.</h2></div>
          <div className="flex max-w-xl flex-wrap gap-3"><ButtonLink href="/book">Book Appointment</ButtonLink><ButtonLink href="/get-a-quote" variant="secondary">Get a Quote</ButtonLink><ButtonLink href={contactLinks.phone} variant="secondary">Call</ButtonLink><ButtonLink href={contactLinks.whatsapp} variant="secondary" target="_blank" rel="noreferrer">WhatsApp</ButtonLink></div>
        </Container>
      </section>
    </>
  );
}
