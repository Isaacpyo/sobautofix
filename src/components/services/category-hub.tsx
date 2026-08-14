import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { Container, Eyebrow } from "@/components/ui/container";

export type ServiceCategoryKey = "diagnostics" | "repairs" | "mobile";

const categories: Array<{ key: ServiceCategoryKey; label: string; href: string; description: string }> = [
  { key: "diagnostics", label: "Diagnostics", href: "/diagnostics", description: "Fault finding, warning lights and system testing." },
  { key: "repairs", label: "Repairs & Maintenance", href: "/services/repairs-maintenance", description: "Servicing and evidence-led mechanical repairs." },
  { key: "mobile", label: "Mobile & Specialist", href: "/services/mobile-specialist", description: "Mobile support, recovery, inspections and fleet work." },
];

export function ServiceCategoryNavigation({ current }: { current?: ServiceCategoryKey }) {
  return (
    <section className="sticky top-[4.5rem] z-40 border-y border-[#E4EAF0] bg-white/96 py-3 shadow-sm backdrop-blur-xl md:py-6 xl:top-20" aria-labelledby="service-categories-heading">
      <Container>
        <Eyebrow className="hidden md:block">Explore our services</Eyebrow>
        <h2 id="service-categories-heading" className="sr-only">Service categories</h2>
        <nav aria-label="Service categories" className="grid grid-cols-3 gap-2 md:gap-3">
          {categories.map((category) => {
            const active = category.key === current;
            return (
              <Link
                key={category.key}
                href={category.href}
                aria-current={active ? "page" : undefined}
                className={active
                  ? "premium-card group border border-[#1974E2] bg-[#EAF3FF] p-3 text-[#071127] md:p-4"
                  : "premium-card group border border-[#E4EAF0] bg-[#F8FAFC] p-3 text-[#071127] transition hover:border-[#1974E2]/55 hover:bg-white md:p-4"}
              >
                <span className="flex items-center justify-between gap-1 text-xs font-bold md:gap-3 md:text-base">{category.label}<ArrowRight size={16} className="shrink-0 text-[#1974E2] transition group-hover:translate-x-1" aria-hidden="true" /></span>
                <span className="mt-1 hidden text-xs leading-5 text-[#586575] md:block">{category.description}</span>
              </Link>
            );
          })}
        </nav>
      </Container>
    </section>
  );
}

export type CategoryFaq = { question: string; answer: string };

export function CategoryFaqs({ faqs, eyebrow = "Questions about this service category", faqHref, backgroundClassName = "bg-[#F4F7FA]" }: { faqs: CategoryFaq[]; eyebrow?: string; faqHref?: string; backgroundClassName?: string }) {
  return (
    <section className={`${backgroundClassName} py-20 sm:py-24`}>
      <Container className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-balance text-4xl font-extrabold text-[#071127] sm:text-5xl">Useful answers before you get in touch.</h2>
          {faqHref && <Link href={faqHref} className="mt-5 inline-flex items-center gap-2 font-bold text-[#1974E2] hover:text-[#145CAD]">View all FAQs <ArrowRight size={16} aria-hidden="true" /></Link>}
        </div>
        <div className="grid content-start gap-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="group rounded-[1.25rem_.25rem_1.25rem_.25rem] border border-[#E4EAF0] bg-white p-5 transition open:border-[#1974E2]/40 open:shadow-lg" data-reveal>
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 font-bold text-[#071127] marker:content-none">
                {faq.question}
                <span className="text-xl text-[#1974E2] transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 max-w-2xl pr-8 leading-7 text-[#586575]">{faq.answer}</p>
            </details>
          ))}
        </div>
      </Container>
      <JsonLd value={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }} />
    </section>
  );
}
