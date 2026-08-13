import { PageHero } from "@/components/marketing/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Frequently Asked Questions", "Answers about diagnostics, mobile appointments, electrical faults, inspections, booking and vehicle sales at SOB Autofix.", "/faqs");

const faqs = [
  ["What does a vehicle diagnostic test tell you?", "A scan can identify stored faults, affected systems and useful live data. It is evidence for the investigation, but targeted testing may still be needed before the cause is confirmed."],
  ["Do you provide mobile diagnostics?", "Yes, suitable diagnostic work can be carried out at a vehicle’s location. Availability depends on the problem, location and access."],
  ["Can you investigate electrical faults?", "Yes. Electrical fault finding may cover battery drain, starting and charging problems, warning lights, wiring, sensors and module communication."],
  ["Can you come to my location?", "Mobile appointments are available for suitable work. Share the vehicle, postcode, symptoms and whether it can be driven so the request can be assessed."],
  ["Do you work on all vehicle makes?", "Contact us with the registration and problem. Vehicle coverage can depend on the system, equipment access and work required."],
  ["Do I need an appointment?", "Booking or contacting SOB Autofix before travelling is recommended so availability and the correct service route can be confirmed."],
  ["How do I check appointment availability?", "Use the booking calendar or contact SOB Autofix by phone, WhatsApp or enquiry form to confirm the current options for your vehicle and location."],
  ["Can you inspect a car before I buy it?", "Pre-purchase inspections can combine visible mechanical observations with a diagnostic scan where appropriate."],
  ["Do you sell used cars?", "Yes. Only genuine approved stock appears on the cars-for-sale page, with finance and warranty wording configured per vehicle."],
] as const;

export default function FaqPage() { return <><PageHero title="Straight answers before you book." body="Learn what diagnostic work can establish, how mobile requests are assessed and what to expect from the main customer journeys." showTrustFacts={false} /><section className="py-20"><Container className="max-w-4xl"><div className="grid gap-4">{faqs.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[#E4EAF0] bg-white p-6 open:border-[#1974E2]/40 open:shadow-lg"><summary className="cursor-pointer list-none text-xl font-bold text-[#071127] marker:hidden">{question}<span className="float-right text-[#1974E2] group-open:rotate-45">+</span></summary><p className="mt-4 max-w-3xl leading-7 text-[#586575]">{answer}</p></details>)}</div><div className="mt-10 rounded-2xl bg-[#071127] p-8 text-white"><h2 className="text-3xl font-bold">Have a vehicle-specific question?</h2><p className="mt-3 text-[#C6D2DF]">Send the registration and symptoms for a more useful response.</p><ButtonLink className="mt-5" href="/get-a-quote">Send the details</ButtonLink></div></Container></section></>; }
