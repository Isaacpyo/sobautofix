import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata(
  "Car Diagnostics, Repairs & Booking FAQs",
  "Answers about car diagnostics, warning lights, electrical faults, mobile mechanic visits, servicing, booking and vehicle inspections in Doncaster.",
  "/faqs",
);

type Faq = { question: string; answer: string };
type FaqCategory = { id: string; title: string; description: string; faqs: readonly Faq[] };

const faqCategories: readonly FaqCategory[] = [
  {
    id: "diagnostics",
    title: "Car diagnostics and warning lights",
    description: "What diagnostic testing can establish and what happens after a fault code is found.",
    faqs: [
      {
        question: "What does a vehicle diagnostic test tell you?",
        answer: "A scan can identify stored faults, affected systems and useful live data. It provides evidence for the investigation, but targeted testing may still be needed before the cause is confirmed.",
      },
      {
        question: "Does a fault code tell you exactly which part has failed?",
        answer: "Not always. A fault code identifies the system or condition detected by the vehicle. Wiring, power supplies, sensors, mechanical faults and other components may need testing before any repair is recommended.",
      },
      {
        question: "Why is my engine management light on?",
        answer: "The engine management light can be triggered by many faults involving emissions, ignition, fuelling, sensors or control systems. Reading the stored codes and testing the relevant system is the reliable way to narrow down the cause.",
      },
      {
        question: "Can you diagnose an intermittent car fault?",
        answer: "Intermittent faults can often be investigated using stored history, live data, symptoms and targeted tests. Some faults may need to be present during testing or monitored over time before they can be confirmed.",
      },
      {
        question: "How long does a car diagnostic test take?",
        answer: "It depends on the symptoms and the system involved. A basic scan can be quick, while accurate fault finding may require circuit checks, live-data analysis or mechanical testing. The likely scope can be discussed before the appointment.",
      },
    ],
  },
  {
    id: "electrical",
    title: "Electrical, battery and starting faults",
    description: "Common questions about non-starts, flat batteries, charging systems and vehicle electrics.",
    faqs: [
      {
        question: "Can you investigate vehicle electrical faults?",
        answer: "Yes. Electrical fault finding may cover battery drain, starting and charging problems, warning lights, wiring, sensors and communication between vehicle modules.",
      },
      {
        question: "Why will my car not start even though the lights work?",
        answer: "Interior or dashboard lights do not prove that the battery can supply enough current to start the engine. The battery, starter circuit, connections, immobiliser and engine-control systems may all need checking.",
      },
      {
        question: "Why does my car battery keep going flat?",
        answer: "Possible causes include a weak battery, a charging-system fault, poor connections or an electrical drain while the vehicle is parked. Testing helps separate these causes before parts are replaced.",
      },
      {
        question: "How can you tell whether the battery or alternator is faulty?",
        answer: "Battery condition and charging performance can be measured rather than guessed. Voltage, load, current and connection checks help show whether the fault is with the battery, alternator, wiring or another system.",
      },
    ],
  },
  {
    id: "mobile",
    title: "Mobile mechanic appointments",
    description: "How mobile diagnostics and suitable repair visits work around Doncaster and South Yorkshire.",
    faqs: [
      {
        question: "Do you provide mobile car diagnostics in Doncaster?",
        answer: "Yes, suitable diagnostic work can be carried out at a vehicle’s location in and around Doncaster. Availability depends on the fault, location, access and testing required.",
      },
      {
        question: "Can a mobile mechanic come to my home or workplace?",
        answer: "Mobile appointments are available for suitable work. Share the vehicle, postcode, symptoms and whether it can be driven so the location and job can be assessed.",
      },
      {
        question: "What work can be completed during a mobile appointment?",
        answer: "Diagnostics, inspections and some repairs may be suitable for a mobile visit. The final scope depends on safe access, the equipment needed, the fault found and whether workshop facilities are required.",
      },
      {
        question: "What information should I provide when booking a mobile mechanic?",
        answer: "Send the registration, postcode, symptoms, warning lights, when the problem occurs and whether the vehicle starts or drives. Clear details help confirm whether a mobile visit is appropriate.",
      },
    ],
  },
  {
    id: "repairs-servicing",
    title: "Car repairs and servicing",
    description: "What to expect when a fault needs repair, routine servicing or further specialist work.",
    faqs: [
      {
        question: "Can you repair a fault after diagnosing it?",
        answer: "Where the required repair is within scope, the findings and next steps can be discussed before work proceeds. Some jobs may need workshop facilities, additional parts or a relevant specialist.",
      },
      {
        question: "Will I receive a price before repair work starts?",
        answer: "The vehicle details and diagnostic findings are used to define the work and provide the most useful estimate possible. If further faults are uncovered, the additional work can be discussed before proceeding.",
      },
      {
        question: "Do you offer routine vehicle servicing?",
        answer: "Yes. Vehicle servicing is available alongside diagnostics and repair work. Provide the registration and current mileage so the appropriate service requirements can be checked.",
      },
      {
        question: "Do you work on every make and model of car?",
        answer: "Contact SOB Autofix with the registration and problem. Coverage can depend on the vehicle system, equipment access, parts and the work required.",
      },
      {
        question: "Is it safe to drive with a warning light on?",
        answer: "That depends on the warning and how the vehicle is behaving. Stop safely and seek assistance for a red warning, overheating, loss of oil pressure, braking concerns or severe symptoms. Other warnings should still be assessed promptly.",
      },
    ],
  },
  {
    id: "booking",
    title: "Booking and appointments",
    description: "Availability, appointment changes and the details that help us assess your request.",
    faqs: [
      {
        question: "Do I need an appointment?",
        answer: "Booking or contacting SOB Autofix before travelling is recommended so availability and the correct service route can be confirmed.",
      },
      {
        question: "How do I check appointment availability?",
        answer: "Use the online booking calendar or contact SOB Autofix by phone, WhatsApp or the enquiry form to confirm the current options for your vehicle and location.",
      },
      {
        question: "How do I change or cancel a booking?",
        answer: "Use the booking-management option in your confirmation where available. If the appointment is close, work has started or online changes are unavailable, contact SOB Autofix directly.",
      },
      {
        question: "What details should I include in a repair enquiry?",
        answer: "Include the registration, mileage, symptoms, warning lights, when the issue started and whether the vehicle can be driven. Photos or previous diagnostic information may also help where relevant.",
      },
    ],
  },
  {
    id: "inspections-sales",
    title: "Vehicle inspections and cars for sale",
    description: "Pre-purchase checks and how to enquire about approved used vehicles.",
    faqs: [
      {
        question: "Can you inspect a used car before I buy it?",
        answer: "Pre-purchase inspections can combine visible mechanical observations with a diagnostic scan where appropriate. Confirm the vehicle, location and required scope before arranging the inspection.",
      },
      {
        question: "What is included in a pre-purchase vehicle inspection?",
        answer: "The scope is agreed for the vehicle and circumstances. It may include visible condition checks, operational checks and diagnostic scanning, but it cannot guarantee that every hidden or future fault will be found.",
      },
      {
        question: "Does SOB Autofix sell used cars?",
        answer: "Yes. Genuine approved stock is published on the cars-for-sale page, with the available vehicle details and any applicable finance or warranty information shown per listing.",
      },
      {
        question: "How do I enquire about a car for sale?",
        answer: "Open the vehicle listing and use its enquiry option, or contact SOB Autofix with the vehicle details. Availability should be confirmed before making a journey.",
      },
    ],
  },
];

const allFaqs = faqCategories.flatMap((category) => category.faqs);

export default function FaqPage() {
  return (
    <>
      <PageHero
        title="Car diagnostics, repairs and booking FAQs."
        body="Practical answers about warning lights, electrical faults, mobile mechanic visits, servicing, inspections and appointments in Doncaster."
        compact
        showTrustFacts={false}
      />

      <section className="py-14 sm:py-16">
        <Container className="max-w-5xl">
          <nav aria-label="FAQ categories" className="mb-12 flex flex-wrap gap-2">
            {faqCategories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="rounded-full border border-[#D4DEE8] bg-white px-4 py-2 text-sm font-bold text-[#071127] transition hover:border-[#1974E2] hover:text-[#1974E2]"
              >
                {category.title}
              </a>
            ))}
          </nav>

          <div className="space-y-14">
            {faqCategories.map((category) => (
              <section key={category.id} id={category.id} className="scroll-mt-28" aria-labelledby={`${category.id}-heading`}>
                <div className="mb-5 border-l-4 border-[#1974E2] pl-4">
                  <h2 id={`${category.id}-heading`} className="text-2xl font-extrabold text-[#071127] sm:text-3xl">{category.title}</h2>
                  <p className="mt-2 max-w-3xl leading-7 text-[#586575]">{category.description}</p>
                </div>
                <div className="grid gap-3">
                  {category.faqs.map((faq) => (
                    <details key={faq.question} className="group rounded-2xl border border-[#E4EAF0] bg-white p-5 open:border-[#1974E2]/40 open:shadow-lg sm:p-6">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-bold text-[#071127] marker:content-none sm:text-xl">
                        {faq.question}
                        <span className="shrink-0 text-[#1974E2] transition group-open:rotate-45" aria-hidden="true">+</span>
                      </summary>
                      <p className="mt-3 max-w-3xl pr-8 leading-7 text-[#586575]">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-14 rounded-2xl bg-[#071127] p-8 text-white">
            <h2 className="text-3xl font-bold">Have a vehicle-specific question?</h2>
            <p className="mt-3 text-[#C6D2DF]">Send the registration and symptoms for a more useful response.</p>
            <ButtonLink className="mt-5" href="/get-a-quote">Send the details</ButtonLink>
          </div>
        </Container>
      </section>

      <JsonLd value={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: allFaqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }} />
    </>
  );
}
