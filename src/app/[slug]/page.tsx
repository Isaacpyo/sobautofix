import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { ContentRenderer } from "@/components/content/content-renderer";
import { PageHero } from "@/components/marketing/page-hero";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { Container, Eyebrow } from "@/components/ui/container";
import { legalContent, topLevelContent } from "@/config/landing-content";
import { createMetadata } from "@/lib/seo";
import { getPublishedContent } from "@/lib/content/repository";

export function generateStaticParams() {
  return [...Object.keys(topLevelContent), ...Object.keys(legalContent)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cms = await getPublishedContent("core_page", slug);
  if (cms) return createMetadata(cms.seoTitle, cms.seoDescription, `/${slug}`);
  const content = topLevelContent[slug];
  const legal = legalContent[slug];
  if (content) return createMetadata(content.title, content.body, `/${slug}`);
  if (legal) return createMetadata(legal.title, legal.description, `/${slug}`);
  return {};
}

export default async function TopLevelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cms = await getPublishedContent("core_page", slug);
  if (cms) return <ContentRenderer entry={cms} />;
  const content = topLevelContent[slug];
  const legal = legalContent[slug];
  if (legal) {
    return <><PageHero eyebrow="Business information" title={legal.title} body={legal.description} cta={false} /><section className="py-20"><Container className="max-w-3xl"><p className="mb-10 text-sm text-[#667586]">Last updated: 8 August 2026</p><div className="space-y-10">{legal.sections.map((section) => <section key={section.heading}><h2 className="text-3xl font-bold text-[#071127]">{section.heading}</h2><div className="mt-4 space-y-4 leading-7 text-[#586575]">{section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>)}</div></Container></section></>;
  }
  if (!content) notFound();
  return (
    <>
      <PageHero eyebrow={content.eyebrow} title={content.title} body={content.body}>{slug !== "about" ? <VehicleJourney compact source={slug} /> : undefined}</PageHero>
      <section className="py-20 sm:py-24"><Container className="grid gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><Eyebrow>Our approach</Eyebrow><h2 className="text-balance text-4xl font-extrabold text-[#071127] sm:text-5xl">{content.introHeading}</h2></div><div className="space-y-5 text-lg leading-8 text-[#586575]">{content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></Container></section>
      <section className="bg-[#F4F7FA] py-20"><Container><div className="grid gap-5 md:grid-cols-3">{content.highlights.map((item) => <article key={item.title} className="rounded-2xl border border-[#E4EAF0] bg-white p-6"><span className="mb-5 block h-1 w-10 rounded bg-[#1974E2]" /><h2 className="text-2xl font-bold text-[#071127]">{item.title}</h2><p className="mt-3 leading-7 text-[#586575]">{item.body}</p></article>)}</div></Container></section>
      {content.process && <section className="bg-[#071127] py-20 text-white"><Container><Eyebrow className="text-[#67B9FF]">The process</Eyebrow><h2 className="text-4xl font-extrabold">What happens next</h2><ol className="mt-8 grid gap-4 md:grid-cols-4">{content.process.map((step, index) => <li key={step} className="rounded-2xl border border-white/10 bg-white/5 p-5"><span className="text-sm font-black text-[#67B9FF]">0{index + 1}</span><strong className="mt-8 block text-lg">{step}</strong></li>)}</ol></Container></section>}
      {content.enquiryType && <section className="py-20"><Container className="max-w-3xl"><EnquiryForm type={content.enquiryType} askLocation={content.askLocation} title={content.enquiryType === "fleet" ? "Discuss your fleet" : "Send the details"} /></Container></section>}
    </>
  );
}
