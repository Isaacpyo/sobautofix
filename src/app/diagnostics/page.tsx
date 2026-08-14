import { CheckCircle2 } from "lucide-react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContextualServiceImage } from "@/components/marketing/contextual-service-image";
import { DiagnosticServiceCarousel } from "@/components/diagnostics/diagnostic-service-carousel";
import { PageHero } from "@/components/marketing/page-hero";
import { ServiceRegistrationCta } from "@/components/marketing/service-registration-cta";
import { ProcessFlow, SectionIntro } from "@/components/marketing/experience";
import { CategoryFaqs, ServiceCategoryNavigation, type CategoryFaq } from "@/components/services/category-hub";
import { JsonLd } from "@/components/seo/json-ld";
import { Container, Eyebrow } from "@/components/ui/container";
import { diagnostics } from "@/config/site";
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
  { title: "Understand the symptoms", body: "Discuss what has changed, when it happens and any recent work." },
  { title: "Scan and inspect", body: "Review relevant control systems, visible condition and available data." },
  { title: "Test the system", body: "Carry out focused electrical or mechanical checks where appropriate." },
  { title: "Isolate the likely cause", body: "Compare the evidence instead of treating a code as a parts instruction." },
  { title: "Explain the next step", body: "Set out the findings, limitations and recommended route forward." },
];

export default function DiagnosticsPage() {
  const publishedDiagnostics = diagnostics.filter((item) => item.published);

  return (
    <>
      <JsonLd value={serviceJsonLd("Vehicle Diagnostics & Fault Finding", "Professional automotive diagnostics and systematic fault finding in Doncaster and South Yorkshire.", "/diagnostics")} />
      <PageHero
        eyebrow="Professional diagnostics. Not guesswork."
        title="Vehicle Diagnostics & Fault Finding"
        body="Systematic automotive diagnostics for electrical faults, warning lights and vehicle modules across Doncaster and South Yorkshire. We use scans as evidence, then test the relevant system before recommending the next step."
        cta={false}
        showTrustFacts={false}
      />

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
          <SectionIntro eyebrow="Diagnostic services" title="Choose the closest match to the problem." body="If you are unsure, start with Vehicle Diagnostics or use the registration journey above. The appropriate service can be confirmed after the symptoms are reviewed." />
          <div className="mt-10">
            <DiagnosticServiceCarousel items={publishedDiagnostics} />
          </div>
        </Container>
      </section>

      <ProcessFlow eyebrow="A flexible diagnostic process" title="The investigation follows the evidence." body="The exact checks depend on the vehicle and fault. These stages describe the approach rather than promising that every assessment follows an identical sequence." steps={process} />

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
      <ServiceRegistrationCta source="diagnostics" />

    </>
  );
}
