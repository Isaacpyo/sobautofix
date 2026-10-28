import { ArrowRight, ArrowUpRight, CalendarCheck, Car, ClipboardList, Clock, Mail, MapPin, MessageCircle, Phone, Repeat, SearchCheck, Star, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatAddress } from "@/components/exchange/exchange-footer";
import { workshopPhotos } from "@/components/exchange/photos";
import { SellStartForm } from "@/components/exchange/sell-start-band";
import { ButtonLink, Container, Eyebrow, linkClass, Notice, SectionHeading } from "@/components/exchange/ui";
import { VehicleCard } from "@/components/exchange/vehicle-card";
import { diagnostics, services } from "@/config/site";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { formatUkPhone, mainSiteHref, mapsHref, telHref, whatsappHref } from "@/lib/exchange/public/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getLatestAvailable } from "@/lib/exchange/public/stock";
import { getExchangeSettings } from "@/lib/exchange/settings";
import { getVisibleReviews } from "@/lib/reviews/repository";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getExchangeSettings();
  return exchangeMetadata({ path: "/", description: settings.heroBody });
}

function paragraphs(value: string) {
  return value.split(/\n{2,}|\r?\n/).map((part) => part.trim()).filter(Boolean);
}

export default async function ExchangeHomePage() {
  const [base, settings, latest, reviews] = await Promise.all([getExchangeBase(), getExchangeSettings(), getLatestAvailable(6), getVisibleReviews().catch(() => [])]);
  const href = (path: string) => exchangeHref(base, path);
  const main = (path: string) => mainSiteHref(base, path);
  const workshopServices = [...diagnostics, ...services].filter((service) => service.published).slice(0, 6);
  const address = formatAddress(settings.address);
  const inspection = paragraphs(settings.inspectionProcess);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#F3F5F8]">
        <Container className="grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-16">
          <div>
            <Eyebrow>{settings.name} · Doncaster</Eyebrow>
            <h1 className="mt-3 text-[44px] leading-[.95] font-bold text-balance text-[#0B1220] sm:text-[60px] lg:text-[68px]">{settings.heroHeading}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-7 text-[#344054] sm:text-lg">{settings.heroBody}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={href("/cars")} className="min-h-14 px-6 text-base"><Car size={20} aria-hidden="true" /> Browse Cars</ButtonLink>
              <ButtonLink href={href("/sell")} variant="secondary" className="min-h-14 px-6 text-base"><Repeat size={20} aria-hidden="true" /> Sell Your Car</ButtonLink>
            </div>
            <p className="mt-5 text-[15px] text-[#5B6575]">
              Need work on your current car? <a href={main("/book")} className={linkClass}>Book a Service</a>
            </p>
          </div>
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-[0_24px_60px_rgba(11,18,32,.18)] lg:aspect-[5/4]">
              <Image src={workshopPhotos.hero.src} alt={workshopPhotos.hero.alt} fill preload sizes="(max-width: 1023px) 100vw, 560px" className="object-cover object-[60%_50%]" placeholder="blur" />
            </div>
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_12px_30px_rgba(11,18,32,.16)] sm:left-6">
              <span className="grid size-10 place-items-center rounded-xl bg-[#EAF2FD] text-[#1462C4]"><Wrench size={20} aria-hidden="true" /></span>
              <p className="text-sm leading-5 text-[#344054]"><strong className="block text-[#0B1220]">Sold by a working workshop</strong>{settings.workshopName}, {settings.address.city}</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Journeys */}
      <section aria-labelledby="journeys-heading" className="py-14 sm:py-20">
        <Container>
          <h2 id="journeys-heading" className="sr-only">What would you like to do?</h2>
          {/* Two journeys side by side at every width; Repairs & Diagnostics has its own section further down. */}
          <ul className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              { title: "Buy a Car", summary: "Used cars with full condition notes.", body: "Browse used cars with the condition, inspection notes and known faults on every listing.", action: "Browse cars", link: href("/cars"), photo: workshopPhotos.buy, icon: Car },
              { title: "Sell or Part Exchange", summary: "Get an offer for your car.", body: "Tell us about your car in a few steps and add photos from your phone. We review every enquiry.", action: "Sell your car", link: href("/sell"), photo: workshopPhotos.sell, icon: Repeat },
            ].map((journey) => (
              <li key={journey.title} className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white transition hover:shadow-[0_12px_32px_rgba(11,18,32,.10)]">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#F3F5F8] sm:aspect-[16/9]">
                  <Image src={journey.photo.src} alt="" fill sizes="(max-width: 639px) 50vw, 600px" className="object-cover object-[50%_35%] transition duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="flex flex-1 flex-col p-3.5 sm:p-5">
                  <span className="grid size-8 place-items-center rounded-lg bg-[#EAF2FD] text-[#1462C4] sm:size-10 sm:rounded-xl"><journey.icon size={18} aria-hidden="true" /></span>
                  <h3 className="mt-2.5 text-[19px] leading-tight font-bold text-[#0B1220] sm:mt-3 sm:text-[26px]">{journey.title}</h3>
                  <p className="mt-1.5 text-sm leading-5 text-[#5B6575] sm:hidden">{journey.summary}</p>
                  <p className="mt-2 hidden leading-7 text-[#5B6575] sm:block">{journey.body}</p>
                  <Link href={journey.link} className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-2 text-[15px] font-semibold text-[#1462C4] after:absolute after:inset-0 after:content-[''] sm:pt-4 sm:text-base">
                    {journey.action} <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Latest cars */}
      <section aria-labelledby="latest-heading" className="bg-[#F3F5F8] py-14 sm:py-20">
        <Container>
          <SectionHeading id="latest-heading" eyebrow="In stock now" title="Latest cars" action={<ButtonLink href={href("/cars")} variant="secondary">View all cars <ArrowRight size={18} aria-hidden="true" /></ButtonLink>} />
          {latest.unavailable ? (
            <Notice className="mt-8" title="Our stock list is temporarily unavailable">Please try again shortly, or call us and we will tell you what is available.</Notice>
          ) : latest.vehicles.length ? (
            <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {latest.vehicles.map((vehicle, index) => (
                <li key={vehicle.id}><VehicleCard vehicle={vehicle} href={href(`/cars/${vehicle.slug}`)} preload={index === 0} /></li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-[#C9D3E0] bg-white p-8 text-center">
              <p className="text-xl font-semibold text-[#0B1220]">No cars are listed right now</p>
              <p className="mx-auto mt-2 max-w-md leading-7 text-[#5B6575]">New cars are listed once they have been prepared and photographed. Tell us what you are looking for and we will keep an eye out.</p>
              <ButtonLink href={href("/contact")} className="mt-5">Tell us what you need</ButtonLink>
            </div>
          )}
        </Container>
      </section>

      {/* Why buy from SOB */}
      <section aria-labelledby="why-heading" className="py-14 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl lg:aspect-[4/5]">
            <Image src={workshopPhotos.inspection.src} alt={workshopPhotos.inspection.alt} fill sizes="(max-width: 1023px) 100vw, 520px" className="object-cover object-[50%_40%]" />
          </div>
          <div>
            <Eyebrow>Why buy from {settings.workshopName}</Eyebrow>
            <h2 id="why-heading" className="mt-1 text-[32px] leading-[1.05] font-bold text-[#0B1220] sm:text-[40px]">You see what we know about each car</h2>
            {inspection.length ? (
              <div className="mt-4 space-y-3 text-base leading-7 text-[#344054]">{inspection.map((text) => <p key={text}>{text}</p>)}</div>
            ) : (
              <p className="mt-4 text-base leading-7 text-[#344054]">Each listing shows its own inspection date, what was checked and what was found, along with known faults and any work completed before sale. Anything we have not confirmed is marked &ldquo;Not confirmed&rdquo;.</p>
            )}
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { icon: SearchCheck, title: "Inspection notes per car", body: "Date, scope and findings, listed on the car's page." },
                { icon: ClipboardList, title: "Faults listed upfront", body: "Known faults, repair projects and recorded write-offs are labelled." },
                { icon: CalendarCheck, title: "Viewings confirmed by staff", body: "Request a time online; we contact you to confirm it." },
                { icon: Wrench, title: "A workshop behind the sale", body: `${settings.workshopName} repairs and diagnoses cars on site.` },
              ].map((point) => (
                <li key={point.title} className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2FD] text-[#1462C4]"><point.icon size={20} aria-hidden="true" /></span>
                  <span><strong className="block text-[#0B1220]">{point.title}</strong><span className="text-[15px] leading-6 text-[#5B6575]">{point.body}</span></span>
                </li>
              ))}
            </ul>
            <Link href={href("/how-buying-works")} className={`${linkClass} mt-6 inline-flex min-h-11 items-center gap-1.5`}>How buying works <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </Container>
      </section>

      {/* Sell band */}
      <section aria-labelledby="sell-heading" className="bg-[#111827] text-white">
        <Container className="grid items-center gap-8 py-14 sm:py-16 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[13px] font-semibold tracking-[.08em] text-[#9CC3F5] uppercase">Sell or part exchange</p>
            <h2 id="sell-heading" className="mt-1 text-[34px] leading-[1.02] font-bold sm:text-[44px]">Thinking of selling your car?</h2>
            <p className="mt-3 max-w-xl leading-7 text-[#D0D5DD]">Enter your registration to start. You will tell us about its condition, add photos, and we will review it. Any offer is subject to inspection and verification.</p>
            <SellStartForm />
          </div>
          <ul className="grid gap-3 text-[15px] text-[#D0D5DD]">
            {["Five short steps with your progress shown", "Add photos straight from your phone", "Ask about part exchange against a car we have listed", "Sending an enquiry does not commit you to sell"].map((point) => (
              <li key={point} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3"><span aria-hidden="true" className="size-2 rounded-full bg-[#7DB5F5]" />{point}</li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Workshop services */}
      <section aria-labelledby="workshop-heading" className="py-14 sm:py-20">
        <Container>
          <SectionHeading id="workshop-heading" eyebrow={`${settings.workshopName} workshop`} title="Repairs & Diagnostics" intro={`Servicing, repairs and diagnostics from the ${settings.workshopName} workshop.`} action={<a href={main("/book")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B1220] px-5 text-[15px] font-semibold text-white hover:bg-[#1F2937]">Book a Service <ArrowUpRight size={18} aria-hidden="true" /></a>} />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workshopServices.map((service) => (
              <li key={service.slug}>
                <a href={main(service.category === "diagnostics" ? `/diagnostics/${service.slug}` : `/services/repairs-maintenance/${service.slug}`)} className="group flex h-full min-h-11 items-start gap-3 rounded-2xl border border-[#E3E8EF] p-4 hover:border-[#B9D4F6] hover:bg-[#F8FAFD]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3F5F8] text-[#0B1220] group-hover:bg-[#EAF2FD] group-hover:text-[#1462C4]"><Wrench size={18} aria-hidden="true" /></span>
                  <span><strong className="block text-[#0B1220]">{service.name}</strong><span className="text-[15px] leading-6 text-[#5B6575]">{service.summary}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Reviews: only real, visible Google reviews of the workshop */}
      {reviews.length > 0 && (
        <section aria-labelledby="reviews-heading" className="bg-[#F3F5F8] py-14 sm:py-20">
          <Container>
            <SectionHeading id="reviews-heading" eyebrow="Google reviews" title={`What customers say about the ${settings.workshopName} workshop`} intro="These reviews were left on Google for our repair and diagnostic work, not for vehicle sales." />
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {reviews.slice(0, 3).map((review) => (
                <li key={review.id} className="flex flex-col rounded-2xl border border-[#E3E8EF] bg-white p-5">
                  <p className="flex items-center gap-1 text-[#B54708]" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} aria-hidden="true" className={index < review.rating ? "fill-current" : "text-[#D0D5DD]"} />)}
                  </p>
                  <blockquote className="mt-3 line-clamp-6 flex-1 leading-7 text-[#344054]">{review.text}</blockquote>
                  <p className="mt-4 text-sm font-semibold text-[#0B1220]">{review.authorName} <span className="font-normal text-[#5B6575]">on Google</span></p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* Location and contact */}
      <section aria-labelledby="visit-heading" className="py-14 sm:py-20">
        <Container className="grid gap-8 rounded-3xl border border-[#E3E8EF] p-6 sm:p-10 lg:grid-cols-3">
          <div>
            <Eyebrow>Visit us</Eyebrow>
            <h2 id="visit-heading" className="mt-1 text-[32px] leading-tight font-bold text-[#0B1220]">Find us in {settings.address.town || settings.address.city}</h2>
            <div className="mt-3 flex gap-2 leading-7"><MapPin size={20} aria-hidden="true" className="mt-1 shrink-0 text-[#1462C4]" /><address className="not-italic">{address}</address></div>
            <a href={mapsHref(address, siteConfig.googleMapsUrl)} target="_blank" rel="noopener noreferrer" className={`${linkClass} mt-2 inline-flex min-h-11 items-center gap-1.5`}>Get directions <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-[22px] font-bold text-[#0B1220]"><Clock size={20} aria-hidden="true" className="text-[#1462C4]" /> Opening hours</h3>
            {settings.openingHours ? (
              <p className="mt-3 leading-7 whitespace-pre-line">{settings.openingHours}</p>
            ) : (
              <p className="mt-3 leading-7">Please call to confirm opening times before you visit. Viewings are by appointment.</p>
            )}
          </div>
          <div>
            <h3 className="text-[22px] font-bold text-[#0B1220]">Get in touch</h3>
            <ul className="mt-3 grid gap-2">
              {settings.phone && <li><a href={telHref(settings.phone)} className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#0B1220] hover:text-[#1462C4]"><Phone size={18} aria-hidden="true" className="text-[#1462C4]" /> {formatUkPhone(settings.phone)}</a></li>}
              {settings.whatsapp && <li><a href={whatsappHref(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#0B1220] hover:text-[#1462C4]"><MessageCircle size={18} aria-hidden="true" className="text-[#1462C4]" /> WhatsApp us</a></li>}
              {settings.email && <li><a href={`mailto:${settings.email}`} className="inline-flex min-h-11 items-center gap-2 font-semibold break-all text-[#0B1220] hover:text-[#1462C4]"><Mail size={18} aria-hidden="true" className="shrink-0 text-[#1462C4]" /> {settings.email}</a></li>}
            </ul>
            <Link href={href("/contact")} className={`${linkClass} mt-2 inline-flex min-h-11 items-center gap-1.5`}>All contact options <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </Container>
      </section>
    </>
  );
}
