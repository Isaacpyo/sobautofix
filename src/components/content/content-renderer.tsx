import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { ServiceCard } from "@/components/marketing/service-card";
import { JsonLd } from "@/components/seo/json-ld";
import { PageHero } from "@/components/marketing/page-hero";
import { PremiumCta, ProcessFlow } from "@/components/marketing/experience";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { areas, diagnostics, services } from "@/config/site";
import { getPublishedMedia } from "@/lib/media/repository";
import { getActiveOffer } from "@/lib/offers/repository";
import { getVisibleReviews } from "@/lib/reviews/repository";
import { serviceJsonLd } from "@/lib/seo";
import type { ContentEntry, ContentSection } from "@/types/domain";

export async function ContentRenderer({ entry }: { entry: ContentEntry }) {
  const sections = await Promise.all(entry.sections.map((section, index) => RenderSection({ section, slug: entry.slug, index })));
  const prefix = entry.kind === "service" ? "/services" : "/diagnostics";
  return <>{(entry.kind === "service" || entry.kind === "diagnostic") && <JsonLd value={serviceJsonLd(entry.title, entry.excerpt, `${prefix}/${entry.slug}`)} />}{sections.map((section, index) => <div key={`section-${index}`}>{section}</div>)}</>;
}

async function RenderSection({ section, slug, index }: { section: ContentSection; slug: string; index: number }) {
  switch (section.type) {
    case "hero": return <PageHero eyebrow={section.eyebrow || "SOB Autofix"} title={section.title} body={section.body}>{section.primaryCta === "vehicle-lookup" ? <VehicleJourney compact source={`cms-${slug}`} /> : undefined}</PageHero>;
    case "richText": return <section className={index % 2 ? "bg-[#F4F7FA] py-20" : "py-20"}><Container className="max-w-4xl">{section.heading && <><Eyebrow>More information</Eyebrow><h2 className="text-4xl font-extrabold text-[#071127]">{section.heading}</h2></>}<div className="mt-5 space-y-5 text-lg leading-8 text-[#586575]">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></Container></section>;
    case "vehicleLookup": return <section className="diagnostic-panel py-20"><Container className="max-w-4xl"><VehicleJourney source={`cms-${slug}`} heading={section.heading} /></Container></section>;
    case "serviceCards": { const items = [...services, ...diagnostics].filter((item) => section.slugs.includes(item.slug)); return <section className="py-20"><Container><h2 className="text-4xl font-extrabold text-[#071127]">{section.heading}</h2><div className="mt-8 grid gap-5 md:grid-cols-3">{items.map((item, itemIndex) => <ServiceCard key={item.slug} index={itemIndex} title={item.name} body={item.summary} href={`/${item.category === "diagnostics" ? "diagnostics" : "services"}/${item.slug}`} />)}</div></Container></section>; }
    case "process": return <ProcessFlow title={section.heading} steps={section.steps.map((step) => ({ title: step }))} />;
    case "trustFacts": return <section className="bg-[#F4F7FA] py-20"><Container><h2 className="text-4xl font-extrabold text-[#071127]">{section.heading}</h2><div className="mt-8 grid gap-5 md:grid-cols-3">{section.facts.map((fact) => <article key={fact.title} className="rounded-2xl border border-[#E4EAF0] bg-white p-6"><h3 className="text-2xl font-bold text-[#071127]">{fact.title}</h3><p className="mt-3 leading-7 text-[#586575]">{fact.body}</p></article>)}</div></Container></section>;
    case "areas": return <section className="py-20"><Container><h2 className="text-4xl font-extrabold text-[#071127]">{section.heading}</h2><div className="mt-6 flex flex-wrap gap-3">{areas.map((area) => <span key={area} className="rounded-full bg-[#F4F7FA] px-4 py-2 text-sm font-semibold">{area}</span>)}</div></Container></section>;
    case "faqs": return <section className="py-20"><Container className="max-w-4xl"><h2 className="text-4xl font-extrabold text-[#071127]">{section.heading}</h2><div className="mt-7 grid gap-4">{section.items.map((item) => <details key={item.question} className="rounded-2xl border border-[#E4EAF0] p-6"><summary className="cursor-pointer text-lg font-bold text-[#071127]">{item.question}</summary><p className="mt-3 leading-7 text-[#586575]">{item.answer}</p></details>)}</div></Container></section>;
    case "relatedLinks": return <section className="bg-[#F4F7FA] py-16"><Container><h2 className="text-3xl font-bold text-[#071127]">{section.heading}</h2><div className="mt-5 flex flex-wrap gap-3">{section.links.map((link) => <Link key={link.href} href={link.href} className="rounded-lg border border-[#1974E2]/20 bg-white px-4 py-3 font-bold text-[#1974E2]">{link.label}</Link>)}</div></Container></section>;
    case "cta": return <PremiumCta eyebrow="Next step" title={section.heading} body={section.body} primaryHref={section.href} primaryLabel={section.label} />;
    case "symptomSelector": return <section className="diagnostic-panel py-20"><Container className="max-w-4xl"><VehicleJourney source={`symptoms-${slug}`} heading={section.heading} /></Container></section>;
    case "offer": { const offer = await getActiveOffer(section.offerId); return offer ? <section className="bg-[#EAF3FF] py-14"><Container><Eyebrow>Current service offer</Eyebrow><h2 className="text-3xl font-extrabold text-[#071127]">{offer.title}</h2><p className="mt-3 max-w-3xl leading-7 text-[#586575]">{offer.description}</p><ButtonLink className="mt-6" href="/contact">Ask about this offer</ButtonLink></Container></section> : null; }
    case "reviews": { const reviews = await getVisibleReviews(); return reviews.length ? <section className="bg-[#F4F7FA] py-20"><Container><h2 className="text-4xl font-extrabold text-[#071127]">{section.heading}</h2><div className="mt-8 grid gap-5 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-[#E4EAF0] bg-white p-6"><div className="flex items-center justify-between"><strong>{review.authorName}</strong><span className="flex items-center gap-1 font-bold text-amber-600"><Star size={16} fill="currentColor" />{review.rating}</span></div><p className="mt-4 leading-7 text-[#586575]">{review.text}</p><a href={review.sourceUri} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-bold text-[#1974E2]">View on Google</a></article>)}</div></Container></section> : null; }
    case "gallery": { const media = (await getPublishedMedia(section.category)).slice(0, 6); return media.length ? <section className="py-20"><Container><h2 className="text-4xl font-extrabold text-[#071127]">{section.heading}</h2><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{media.map((asset) => <figure key={asset.id} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#E4EAF0]"><Image src={asset.url} alt={asset.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" /></figure>)}</div></Container></section> : null; }
    default: return null;
  }
}
