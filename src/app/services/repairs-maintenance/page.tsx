import {
  CheckCircle2,
  CircleGauge,
  ClipboardCheck,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ServiceRegistrationCta } from "@/components/marketing/service-registration-cta";
import { ServiceCard } from "@/components/marketing/service-card";
import {
  CategoryFaqs,
  ServiceCategoryNavigation,
  type CategoryFaq,
} from "@/components/services/category-hub";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { services } from "@/config/site";
import { createMetadata, serviceJsonLd } from "@/lib/seo";
import servicingImage from "../../../../assets/sobautofix-parts (1).png";
import brakeImage from "../../../../assets/sobautofix-parts (2).png";
import engineImage from "../../../../assets/sobautofix-parts (3).png";

export const metadata = createMetadata(
  "Vehicle Repairs & Servicing Doncaster",
  "Vehicle servicing, brake repairs, engine repairs and evidence-led maintenance from SOB Autofix in Doncaster.",
  "/services/repairs-maintenance",
);

const repairsFaqs: CategoryFaq[] = [
  {
    question: "Can I request a repair if I do not know what is wrong?",
    answer:
      "Yes. Describe the symptoms rather than choosing a component. SOB Autofix can review whether diagnosis, inspection or a repair appointment is the appropriate starting point.",
  },
  {
    question: "Will repair work begin automatically after an assessment?",
    answer:
      "No. The findings and proposed next step should be explained before additional repair work proceeds.",
  },
  {
    question: "Can all repair work be completed at my location?",
    answer:
      "No. Selected work may be suitable for a mobile appointment, while repairs needing lifting equipment, controlled workshop equipment or extensive access are better handled in the workshop.",
  },
  {
    question: "Does SOB Autofix carry out clutch replacement directly?",
    answer:
      "Clutch replacement is arranged through the specialist repair network. The delivery route and scope are confirmed for the individual vehicle before work is agreed.",
  },
];

const symptoms = [
  "Unusual noise",
  "Vibration",
  "Warning lights",
  "Reduced performance",
  "Braking changes",
  "Steering changes",
  "Starting problems",
  "Visible fluid leaks",
];
const capabilities = [
  "Suspension and steering concerns",
  "Cambelt and timing-chain work",
  "Oil and filter servicing",
  "Exhaust repairs",
  "Alternator and starter-motor work",
  "Battery testing and replacement",
  "Electrical repairs after fault finding",
  "Clutch replacement through a specialist network",
];
const serviceCardImages = {
  "vehicle-servicing": servicingImage,
  "engine-repair": engineImage,
  "brake-repair": brakeImage,
};

export default function RepairsMaintenancePage() {
  const coreServices = services.filter((item) => item.published);

  return (
    <>
      <JsonLd
        value={serviceJsonLd(
          "Vehicle Repairs & Maintenance",
          "Vehicle servicing and evidence-led mechanical repair work in Doncaster.",
          "/services/repairs-maintenance",
        )}
      />
      <PageHero
        eyebrow="Repairs & maintenance"
        title="Vehicle Repairs & Maintenance"
        body="From routine servicing to fault-led repairs, SOB Autofix provides practical vehicle maintenance backed by proper diagnosis and a clear explanation of the work required."
        cta={false}
        showTrustFacts={false}
      />

      <ServiceCategoryNavigation current="repairs" />

      <section className="py-20 sm:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <Eyebrow>Core repair services</Eyebrow>
              <h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">
                Maintain the vehicle. Investigate the fault. Approve the right
                work.
              </h2>
            </div>
            <p className="text-lg leading-8 text-[#586575]">
              Individual service pages explain the confirmed launch services in
              more detail. If the problem does not fit one card, submit the
              symptoms and vehicle information instead of guessing which part
              needs replacing.
            </p>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-5">
            {coreServices.map((item, index) => (
              <ServiceCard
                key={item.slug}
                title={item.name}
                body={item.summary}
                href={`/services/${item.slug}`}
                icon={item.category === "servicing" ? "service" : "repair"}
                image={serviceCardImages[item.slug as keyof typeof serviceCardImages]}
                mobileSeparator={index > 0}
              />
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-[#071127] py-20 text-white sm:py-24">
        <Container className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
            <CircleGauge className="text-[#67B9FF]" size={28} />
            <Eyebrow className="mt-8 text-[#67B9FF]">
              Preventative maintenance
            </Eyebrow>
            <h2 className="text-3xl font-bold">
              Look after known service needs before they become larger problems.
            </h2>
            <p className="mt-4 leading-7 text-[#B7C5D7]">
              Scheduled servicing, fluid and filter attention, brake checks and
              general vehicle observations help create a clearer picture of
              condition and upcoming maintenance.
            </p>
          </article>
          <article className="rounded-3xl border border-[#1974E2]/30 bg-[#1974E2]/10 p-7 sm:p-9">
            <Wrench className="text-[#67B9FF]" size={28} />
            <Eyebrow className="mt-8 text-[#67B9FF]">Fault-led repairs</Eyebrow>
            <h2 className="text-3xl font-bold">
              Start with what the vehicle is doing, not a parts list.
            </h2>
            <p className="mt-4 leading-7 text-[#B7C5D7]">
              Reported symptoms, inspection findings and diagnostic evidence are
              used to define the repair scope. Further investigation may be
              needed when the cause is not yet clear.
            </p>
          </article>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Signs to discuss</Eyebrow>
            <h2 className="text-4xl font-extrabold text-[#071127]">
              Changes in how the vehicle sounds, feels or performs.
            </h2>
            <p className="mt-4 leading-7 text-[#586575]">
              These symptoms do not confirm a diagnosis. They are useful
              starting information when requesting an assessment.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {symptoms.map((symptom) => (
                <span
                  key={symptom}
                  className="rounded-xl border border-[#E4EAF0] bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#071127]"
                >
                  {symptom}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-[#F4F7FA] p-7 sm:p-9">
            <Eyebrow>Other verified capabilities</Eyebrow>
            <h2 className="text-3xl font-bold text-[#071127]">
              Discuss the work your vehicle requires.
            </h2>
            <p className="mt-3 leading-7 text-[#586575]">
              These capabilities do not yet have separate published pages.
              Availability and delivery method are confirmed for the specific
              vehicle and scope.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {capabilities.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm leading-6 text-[#586575]"
                >
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-[#1974E2]"
                    size={18}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="border-y border-[#E4EAF0] bg-white py-20 sm:py-24">
        <Container>
          <div className="max-w-3xl">
            <Eyebrow>How repair work is approached</Eyebrow>
            <h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">
              A practical route from symptom to approved work.
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            <ApproachStep
              icon={ClipboardCheck}
              number="01"
              title="Review"
              body="Confirm the vehicle, symptoms, service history where available and the suitable appointment route."
            />
            <ApproachStep
              icon={ShieldCheck}
              number="02"
              title="Assess"
              body="Inspect or test what is relevant before defining the repair recommendation."
            />
            <ApproachStep
              icon={Wrench}
              number="03"
              title="Repair"
              body="Carry out agreed work through the appropriate workshop, mobile or specialist route."
            />
          </ol>
          <div className="mt-10 flex flex-wrap gap-4 text-sm font-bold">
            <ButtonLink href="/diagnostics" variant="outline">
              Explore Diagnostics
            </ButtonLink>
            <ButtonLink href="/services/mobile-specialist" variant="outline">
              Mobile & Specialist Services
            </ButtonLink>
          </div>
        </Container>
      </section>

      <CategoryFaqs faqs={repairsFaqs} />

      <ServiceRegistrationCta source="repairs-maintenance" />
    </>
  );
}

function ApproachStep({
  icon: Icon,
  number,
  title,
  body,
}: {
  icon: typeof Wrench;
  number: string;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-2xl border border-[#E4EAF0] bg-[#F8FAFC] p-6">
      <div className="flex items-center justify-between">
        <Icon className="text-[#145CAD]" size={24} />
        <span className="text-sm font-black text-[#145CAD]">{number}</span>
      </div>
      <h3 className="mt-8 text-2xl font-bold text-[#071127]">{title}</h3>
      <p className="mt-3 leading-7 text-[#586575]">{body}</p>
    </li>
  );
}
