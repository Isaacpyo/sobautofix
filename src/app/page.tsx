import { ArrowRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ContextualServiceImage, heroImage } from "@/components/marketing/contextual-service-image";
import { JsonLd } from "@/components/seo/json-ld";
import { ArticleCard } from "@/components/news/article-card";
import { ServiceCard } from "@/components/marketing/service-card";
import { TrustBar } from "@/components/marketing/trust-bar";
import { HomeCoverageMap } from "@/components/marketing/home-coverage-map";
import { GoogleReviewsSection } from "@/components/reviews/google-reviews-section";
import { PremiumCta, ProcessFlow, SectionIntro } from "@/components/marketing/experience";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { contactLinks, diagnostics, services } from "@/config/site";
import { createMetadata, localBusinessJsonLd } from "@/lib/seo";
import { getActiveOffer } from "@/lib/offers/repository";
import { getPublishedArticles } from "@/lib/news/repository";
import { getPublicSaleVehicles } from "@/lib/sales/repository";
import { formatCurrency } from "@/lib/utils";
import styles from "./home.module.css";

export const metadata = createMetadata(
  "Professional Diagnostics. Not Guesswork.",
  "Professional vehicle diagnostics, electrical fault finding, repairs, servicing and vehicle sales in Doncaster.",
  "/",
);

export default async function HomePage() {
  const [offer, articles, vehicles] = await Promise.all([getActiveOffer(), getPublishedArticles(3), getPublicSaleVehicles()]);
  return (
    <>
      <JsonLd value={localBusinessJsonLd()} />
      <section className={`hero-grid relative overflow-hidden py-16 text-white sm:py-20 lg:py-28 ${styles.hero}`} data-motion="off">
        <Image src={heroImage} alt="" fill preload sizes="100vw" className={`object-cover object-center opacity-90 ${styles.heroImage}`} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroGrid} aria-hidden="true" />
        <Container className="relative grid items-center gap-12 lg:grid-cols-[1fr_.95fr]">
          <div className={styles.heroCopy}>
            <h1 className={`text-balance font-extrabold ${styles.heroTitle}`}>Professional Diagnostics,<br /><span className="text-[#168BFF]">and Repair.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#C6D2DF]">Automotive diagnostics, electrical fault finding, repairs, servicing and vehicle sales.</p>
            <div className="mt-8 hidden flex-wrap gap-3 lg:flex"><ButtonLink href="/book">Book appointment <ArrowRight size={18} /></ButtonLink><ButtonLink href={contactLinks.phone} variant="secondary">Call SOB Autofix</ButtonLink></div>
          </div>
          <VehicleJourney compact source="homepage" lightSurface />
        </Container>
        <span className={styles.scroll} aria-hidden="true">Scroll to explore</span>
      </section>

      <TrustBar />

      <section className="deferred-section py-20 sm:py-28">
        <Container>
          <SectionIntro eyebrow="What we do" title="Start with the fault. Then plan the repair." body="Modern vehicles are interconnected. A warning or fault code points us towards a system; professional testing helps identify what is actually wrong." />
          <div className={styles.servicesGrid}>
            <ServiceCard compact horizontal title="Advanced diagnostics" body="Scan relevant systems, analyse evidence and carry out targeted checks." href="/diagnostics" />
            <ServiceCard compact horizontal title="Auto electrical" body="Investigate wiring, sensors, power supplies, drains and communication faults." href="/diagnostics/electrical-fault-finding" icon="diagnostic" />
            <ServiceCard compact horizontal title="Repairs & servicing" body="Clear recommendations followed by approved maintenance and repair work." href="/services" icon="repair" />
            <ServiceCard compact horizontal title="Mobile & specialist" body="Practical mobile support, inspections, recovery requests and fleet work where suitable." href="/services/mobile-specialist" icon="inspection" />
          </div>
        </Container>
      </section>

      {offer && <section className="bg-[#EAF3FF] py-14"><Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"><div><Eyebrow>Current service offer</Eyebrow><h2 className="text-3xl font-extrabold text-[#071127]">{offer.title}</h2><p className="mt-2 max-w-3xl leading-7 text-[#586575]">{offer.description}</p></div><ButtonLink href="/services/vehicle-servicing">View servicing</ButtonLink></Container></section>}

      <section className="deferred-section diagnostic-panel py-20 text-white sm:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div><ContextualServiceImage id="diagnostics" className="mb-8 min-h-64 shadow-none" /><Eyebrow className="text-[#67B9FF]">Vehicle diagnostics</Eyebrow><h2 className="text-balance text-5xl font-extrabold">A fault code is a starting point—not the answer.</h2><p className="mt-5 text-lg leading-8 text-[#C6D2DF]">We combine system scans with focused electrical and mechanical tests. That means recommendations are based on evidence, not a parts list generated by a scanner.</p><ButtonLink className="mt-8" href="/diagnostics">Explore diagnostics</ButtonLink></div>
            <div className={styles.diagnosticList}>{diagnostics.filter((item) => item.published).slice(0, 6).map((item) => <ServiceCard key={item.slug} compact title={item.name} body={item.summary} href={`/diagnostics/${item.slug}`} dark />)}</div>
          </div>
        </Container>
      </section>

      <section className="deferred-section py-20 sm:py-28">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_.75fr] lg:items-end"><div className="flex flex-col justify-between gap-6"><div className="max-w-2xl"><Eyebrow>Repairs & servicing</Eyebrow><h2 className="text-5xl font-extrabold text-[#071127]">Approved work, clearly explained.</h2></div><Link className="font-bold text-[#1974E2]" href="/services">View all verified services →</Link></div><ContextualServiceImage id="service" className="min-h-72" /></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{services.filter((item) => item.published).map((item) => <ServiceCard key={item.slug} mobileCompact tight title={item.name} body={item.summary} href={`/services/${item.slug}`} icon={item.slug === "vehicle-servicing" ? "service" : "repair"} />)}</div>
        </Container>
      </section>


      <ProcessFlow eyebrow="How SOB Autofix works" title="From symptom to a sensible next step." body="The exact route follows the vehicle and evidence, not a pre-set parts list." steps={[{ title: "Symptom", body: "Tell us what changed and when it occurs." }, { title: "Diagnosis", body: "Review the vehicle, systems and available data." }, { title: "Test", body: "Carry out focused electrical or mechanical checks." }, { title: "Explanation", body: "Set out the findings and limitations clearly." }, { title: "Repair", body: "Plan approved work when the required route is known." }]} />

      <section className="deferred-section py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div><Eyebrow>Areas covered</Eyebrow><h2 className="text-5xl font-extrabold text-[#071127]">Serving Doncaster and South Yorkshire.</h2><p className="mt-5 leading-7 text-[#586575]">Workshop and mobile availability depends on the service and location. Contact us with the vehicle and postcode to confirm.</p><ButtonLink className="mt-7" href="/areas">View coverage</ButtonLink></div>
          <HomeCoverageMap />
        </Container>
      </section>

      {vehicles.length > 0 && <section className="bg-white py-20 sm:py-24"><Container><div className="flex flex-wrap items-end justify-between gap-5"><SectionIntro eyebrow="Cars for sale" title="Current approved stock." /><Link className="inline-flex items-center gap-2 font-bold text-[#1446A5]" href="/cars-for-sale">View all vehicles <ArrowRight size={16} /></Link></div><div className={styles.stockGrid}>{vehicles.slice(0, 3).map((vehicle) => <Link className={styles.stockCard} key={vehicle.id} href={`/cars-for-sale/${vehicle.slug}`} data-reveal><div className={styles.stockMedia}>{vehicle.images[0] ? <Image fill sizes="(max-width: 768px) 100vw, 33vw" src={vehicle.images[0].url} alt={vehicle.images[0].alt} /> : <span className="grid h-full place-items-center text-[#9AA7B6]"><ImageIcon size={38} /></span>}</div><div className={styles.stockBody}><div><p className={styles.stockMeta}>{vehicle.year} · {vehicle.fuelType}</p><h3>{vehicle.make} {vehicle.model}</h3></div><strong>{formatCurrency(vehicle.price)}</strong></div></Link>)}</div></Container></section>}
      {articles.length > 0 && <section className="border-y border-[#E4EAF0] bg-[#F4F7FA] py-20 sm:py-24"><Container><div className="flex flex-wrap items-end justify-between gap-5"><div><Eyebrow>News &amp; Blog</Eyebrow><h2 className="text-4xl font-extrabold text-[#071127] sm:text-5xl">Useful advice from the workshop.</h2></div><Link className="inline-flex items-center gap-2 font-bold text-[#1446A5]" href="/news">View all articles <ArrowRight size={16} /></Link></div><div className="mt-10 grid gap-5 md:grid-cols-3">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div></Container></section>}
      <PremiumCta eyebrow="Ready when you are" title="Start with the vehicle. Leave the guesswork behind." />
      <GoogleReviewsSection />
    </>
  );
}
