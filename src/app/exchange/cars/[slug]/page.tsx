import { AlertTriangle, ExternalLink, Info, PlayCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { AvailabilityChip, Container, DisclosureBadges, linkClass, Notice, Price, SectionHeading } from "@/components/exchange/ui";
import { VehicleCard } from "@/components/exchange/vehicle-card";
import { VehicleActions } from "@/components/exchange/vehicle-enquiry";
import { VehicleGallery } from "@/components/exchange/vehicle-gallery";
import { BackToResults, ShareLink, TrackVehicleView } from "@/components/exchange/vehicle-page-client";
import { NOT_CONFIRMED, NOT_PUBLISHED_COPY } from "@/config/exchange";
import { exchangeHref } from "@/lib/exchange/host";
import { exchangeCanonical, getExchangeBase } from "@/lib/exchange/links";
import { formatDate, formatMileage, listingConditionLabels, orNotConfirmed, serviceHistoryLabels, vehicleName, writeOffLabels } from "@/lib/exchange/public/format";
import { formatUkPhone, mainSiteHref, telHref, whatsappHref } from "@/lib/exchange/public/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeVehicle, getSimilarVehicles } from "@/lib/exchange/public/stock";
import { getExchangeSettings } from "@/lib/exchange/settings";
import { isSoldPageExpired } from "@/lib/sales/policy";
import type { SaleVehicle } from "@/types/domain";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { vehicle } = await getExchangeVehicle(slug);
  if (!vehicle) return exchangeMetadata({ title: "Car not found", path: `/cars/${slug}`, index: false });
  const name = vehicleName(vehicle);
  return exchangeMetadata({
    title: vehicle.status === "sold" ? `${name} (sold)` : `${name} for sale`,
    description: `${name}${vehicle.derivative ? ` ${vehicle.derivative}` : ""}, ${formatMileage(vehicle.mileage)}, ${vehicle.fuelType}, ${vehicle.transmission}. Condition, inspection notes and known faults listed.`,
    path: `/cars/${vehicle.slug}`,
    index: vehicle.status === "sold" ? false : undefined,
    image: vehicle.images[0]?.url,
  });
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-32 border-t border-[#E3E8EF] py-8 first:border-t-0 first:pt-0">
      <h2 id={id} className="text-[28px] leading-tight font-bold text-[#0B1220]">{title}</h2>
      <div className="mt-4 text-[16px] leading-7 text-[#344054]">{children}</div>
    </section>
  );
}

function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className={items.length > 3 ? "grid overflow-hidden rounded-2xl border border-[#E3E8EF] sm:grid-cols-2" : "grid max-w-xl overflow-hidden rounded-2xl border border-[#E3E8EF]"}>
      {items.map(([label, value]) => (
        <div key={label} className={items.length > 3 ? "flex justify-between gap-4 border-b border-[#E3E8EF] px-4 py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:odd:border-r" : "flex justify-between gap-4 border-b border-[#E3E8EF] px-4 py-3 last:border-b-0"}>
          <dt className="text-[15px] text-[#5B6575]">{label}</dt>
          <dd className={value === NOT_CONFIRMED ? "text-right text-[15px] text-[#5B6575] italic" : "text-right text-[15px] font-semibold text-[#0B1220]"}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-[#5B6575]">{empty}</p>;
  return <ul className="grid gap-2">{items.map((item) => <li key={item} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#1974E2]" />{item}</li>)}</ul>;
}

function Copy({ value }: { value: string }) {
  return <div className="space-y-3">{value.split(/\n{2,}|\r?\n/).filter((part) => part.trim()).map((part) => <p key={part}>{part}</p>)}</div>;
}

export default async function VehiclePage({ params }: Props) {
  const { slug } = await params;
  const [base, settings, lookup] = await Promise.all([getExchangeBase(), getExchangeSettings(), getExchangeVehicle(slug)]);
  const href = (path: string) => exchangeHref(base, path);
  if (lookup.unavailable) {
    return (
      <Container className="py-12">
        <BackToResults />
        <Notice className="mt-6" title="This car's details are temporarily unavailable" role="status">Please try again in a few minutes, or call us on {formatUkPhone(settings.phone)}.</Notice>
      </Container>
    );
  }
  const vehicle = lookup.vehicle;
  if (!vehicle) notFound();
  if (isSoldPageExpired(vehicle)) permanentRedirect(href("/cars"));

  const name = vehicleName(vehicle);
  const sold = vehicle.status === "sold";
  const similar = sold || vehicle.status === "reserved" ? await getSimilarVehicles(vehicle, 3) : [];
  const status = vehicle.status as "available" | "reserved" | "sold";
  const writeOffRecorded = !["not_confirmed", "none_recorded"].includes(vehicle.writeOffStatus);
  const sections = [
    ["overview", "Overview"], ["condition", "Condition"], ["inspection", "Inspection"], ["work", "Work completed"], ["history-mot", "MOT & service"], ["history", "History"], ["features", "Features"], ["warranty", "Warranty"], ["collection", "Collection & delivery"],
  ] as const;

  const keySpecs: Array<[string, string]> = [
    ["Year", String(vehicle.year)],
    ["Mileage", formatMileage(vehicle.mileage)],
    ["Fuel", vehicle.fuelType],
    ["Gearbox", vehicle.transmission],
    ["Body", orNotConfirmed(vehicle.bodyType)],
    ["Colour", orNotConfirmed(vehicle.colour)],
  ];

  return (
    <>
      <TrackVehicleView status={vehicle.status} condition={vehicle.listingCondition} />
      <JsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "Car",
          name: `${name}${vehicle.derivative ? ` ${vehicle.derivative}` : ""}`,
          url: exchangeCanonical(`/cars/${vehicle.slug}`),
          brand: { "@type": "Brand", name: vehicle.make },
          model: vehicle.model,
          vehicleModelDate: String(vehicle.year),
          mileageFromOdometer: { "@type": "QuantitativeValue", value: vehicle.mileage, unitCode: "SMI" },
          fuelType: vehicle.fuelType,
          vehicleTransmission: vehicle.transmission,
          ...(vehicle.colour ? { color: vehicle.colour } : {}),
          ...(vehicle.bodyType ? { bodyType: vehicle.bodyType } : {}),
          ...(vehicle.images[0] ? { image: vehicle.images.map((image) => image.url) } : {}),
          offers: {
            "@type": "Offer",
            priceCurrency: "GBP",
            price: vehicle.price,
            itemCondition: "https://schema.org/UsedCondition",
            availability: vehicle.status === "available" ? "https://schema.org/InStock" : vehicle.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/SoldOut",
            seller: { "@type": "AutoDealer", name: settings.name, legalName: settings.legalName },
          },
        }}
      />
      <Container className="pt-3 pb-12 sm:pt-5">
        <div className="flex items-center justify-between gap-3">
          <BackToResults />
          <ShareLink title={`${name} for sale`} />
        </div>
        {sold && (
          <Notice tone="error" role="status" className="mt-3" title="This car has been sold">It is shown here for reference only. Have a look at our similar cars below or browse everything we have listed.</Notice>
        )}
        {vehicle.status === "reserved" && (
          <Notice tone="warning" role="status" className="mt-3" title="This car is reserved">It is being held for another buyer. You can still ask about it, and we will tell you if it becomes available again.</Notice>
        )}
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] lg:gap-x-10">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <VehicleGallery images={vehicle.images} vehicleName={name} sold={sold} />
          </div>
          <aside aria-label="Price and actions" className="lg:sticky lg:top-[124px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div className="rounded-2xl border border-[#E3E8EF] p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <AvailabilityChip status={vehicle.status} />
                <DisclosureBadges vehicle={vehicle} />
              </div>
              <h1 className="mt-3 text-[36px] leading-[1.02] font-bold text-[#0B1220] sm:text-[44px]">{vehicle.make} {vehicle.model}</h1>
              <p className="mt-1 text-[17px] text-[#5B6575]">{[vehicle.derivative, vehicle.year].filter(Boolean).join(" · ")}</p>
              <p className="mt-4"><span className="sr-only">Price </span><Price value={vehicle.price} className="text-[44px] leading-none" /></p>
              {vehicle.financeAvailable && <p className="mt-2 text-sm text-[#5B6575]">Finance options may be available on this vehicle. Contact us for details.</p>}
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[#E3E8EF] py-4 sm:grid-cols-3 lg:grid-cols-2">
                {keySpecs.map(([label, value]) => (
                  <div key={label}><dt className="text-[13px] text-[#5B6575]">{label}</dt><dd className={value === NOT_CONFIRMED ? "text-[15px] text-[#5B6575] italic" : "text-[15px] font-semibold text-[#0B1220]"}>{value}</dd></div>
                ))}
              </dl>
              <div className="mt-5">
                <VehicleActions
                  vehicle={{ id: vehicle.id, slug: vehicle.slug, name, derivative: vehicle.derivative, price: vehicle.price, status, imageUrl: vehicle.images[0]?.url, imageAlt: vehicle.images[0]?.alt }}
                  contact={{ phoneHref: telHref(settings.phone), phoneLabel: formatUkPhone(settings.phone), whatsappHref: whatsappHref(settings.whatsapp) }}
                  links={{ privacyHref: mainSiteHref(base, "/privacy"), policiesHref: href("/policies") }}
                />
              </div>
              {!sold && <p className="mt-4 flex gap-2 text-sm leading-6 text-[#5B6575]"><Info size={16} aria-hidden="true" className="mt-1 shrink-0" /> Viewings are requests until we confirm them. We do not take payments or reservations online.</p>}
              {vehicle.stockReference && <p className="mt-2 text-sm text-[#5B6575]">Stock reference {vehicle.stockReference}</p>}
            </div>
          </aside>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <nav aria-label="On this page" className="mb-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ul className="flex gap-2">
                {sections.map(([id, label]) => <li key={id} className="shrink-0"><a href={`#${id}`} className="inline-flex min-h-11 items-center rounded-full border border-[#E3E8EF] px-4 text-sm font-semibold whitespace-nowrap text-[#344054] hover:border-[#1974E2] hover:text-[#1462C4]">{label}</a></li>)}
              </ul>
            </nav>

            <Section id="overview" title="Overview & specifications">
              {vehicle.description && <Copy value={vehicle.description} />}
              {vehicle.videoUrl && (
                <a href={vehicle.videoUrl} target="_blank" rel="noopener noreferrer" className={`${linkClass} mt-4 inline-flex min-h-11 items-center gap-2`}><PlayCircle size={20} aria-hidden="true" /> Watch the video of this car <ExternalLink size={14} aria-hidden="true" /></a>
              )}
              <div className="mt-5">
                <Facts items={[
                  ["Make", vehicle.make], ["Model", vehicle.model], ["Trim", orNotConfirmed(vehicle.derivative)], ["Year", String(vehicle.year)],
                  ["Mileage", formatMileage(vehicle.mileage)], ["Fuel", vehicle.fuelType], ["Gearbox", vehicle.transmission], ["Engine", orNotConfirmed(vehicle.engineSize)],
                  ["Body type", orNotConfirmed(vehicle.bodyType)], ["Colour", orNotConfirmed(vehicle.colour)], ["Doors", orNotConfirmed(vehicle.doors)], ["Seats", orNotConfirmed(vehicle.seats)],
                  ["Previous owners", orNotConfirmed(vehicle.previousOwners)], ["Keys", orNotConfirmed(vehicle.keysCount)],
                ]} />
              </div>
            </Section>

            <Section id="condition" title="Condition & known faults">
              {vehicle.listingCondition === "repair_project" && (
                <Notice tone="warning" className="mb-4" title="Sold as a repair project">This car needs work before it is ready for everyday use. Please read the known faults below and ask us anything before you view it.</Notice>
              )}
              <Facts items={[["Listing", listingConditionLabels[vehicle.listingCondition]]]} />
              <h3 className="mt-5 text-[20px] font-bold text-[#0B1220]">Condition summary</h3>
              <p className={vehicle.conditionSummary ? "mt-2" : "mt-2 text-[#5B6575] italic"}>{vehicle.conditionSummary || NOT_CONFIRMED}</p>
              <h3 className="mt-5 text-[20px] font-bold text-[#0B1220]">Known faults</h3>
              <div className="mt-2"><List items={vehicle.knownFaults} empty="No faults are listed for this car. Ask us if you would like anything checked before you view it." /></div>
            </Section>

            <Section id="inspection" title="Inspection findings">
              {vehicle.inspectionDate || vehicle.inspectionFindings ? (
                <>
                  <Facts items={[["Inspected on", formatDate(vehicle.inspectionDate)]]} />
                  <h3 className="mt-5 text-[20px] font-bold text-[#0B1220]">What was checked</h3>
                  <p className={vehicle.inspectionScope ? "mt-2" : "mt-2 text-[#5B6575] italic"}>{vehicle.inspectionScope || NOT_CONFIRMED}</p>
                  <h3 className="mt-5 text-[20px] font-bold text-[#0B1220]">What was found</h3>
                  <p className={vehicle.inspectionFindings ? "mt-2" : "mt-2 text-[#5B6575] italic"}>{vehicle.inspectionFindings || NOT_CONFIRMED}</p>
                </>
              ) : (
                <p className="text-[#5B6575]">No inspection has been recorded on this listing yet. Inspection status: <span className="italic">{NOT_CONFIRMED}</span>.</p>
              )}
            </Section>

            <Section id="work" title="Work completed before sale">
              <List items={vehicle.workCompleted} empty="No preparation work is listed for this car." />
            </Section>

            <Section id="history-mot" title="MOT & service history">
              <Facts items={[["MOT expiry", formatDate(vehicle.motExpiry)], ["Service history", serviceHistoryLabels[vehicle.serviceHistory]]]} />
              {vehicle.motNotes && <><h3 className="mt-5 text-[20px] font-bold text-[#0B1220]">MOT notes</h3><p className="mt-2">{vehicle.motNotes}</p></>}
              {vehicle.serviceHistoryNotes && <><h3 className="mt-5 text-[20px] font-bold text-[#0B1220]">Service notes</h3><p className="mt-2">{vehicle.serviceHistoryNotes}</p></>}
            </Section>

            <Section id="history" title="Vehicle history & write-off status">
              {writeOffRecorded && (
                <Notice tone="warning" className="mb-4"><span className="flex gap-2"><AlertTriangle size={18} aria-hidden="true" className="mt-1 shrink-0" />{writeOffLabels[vehicle.writeOffStatus]}. This affects the car&apos;s value and insurance; please take it into account.</span></Notice>
              )}
              <Facts items={[["Write-off status", writeOffLabels[vehicle.writeOffStatus]], ["History check", vehicle.historyCheckedOn ? `Checked ${formatDate(vehicle.historyCheckedOn)}` : NOT_CONFIRMED], ["Previous owners", orNotConfirmed(vehicle.previousOwners)]]} />
              {vehicle.historyCheckSummary && <p className="mt-4">{vehicle.historyCheckSummary}</p>}
            </Section>

            <Section id="features" title="Features">
              <List items={vehicle.features} empty="No features are listed for this car." />
            </Section>

            <Section id="warranty" title="Warranty & after-sales">
              <h3 className="text-[20px] font-bold text-[#0B1220]">Warranty</h3>
              <p className="mt-2">
                {vehicle.warranty?.available
                  ? vehicle.warranty.description || "A warranty is available on this car. Ask us for the exact terms before you buy."
                  : "No warranty is listed for this car. Ask us before you buy if you would like to know whether any cover can be arranged."}
              </p>
              <div className="mt-4 flex gap-3 rounded-2xl bg-[#F3F5F8] p-4">
                <ShieldCheck size={20} aria-hidden="true" className="mt-1 shrink-0 text-[#1462C4]" />
                <p className="text-[15px] leading-6"><strong className="text-[#0B1220]">Your statutory rights are separate.</strong> Any warranty is in addition to, and does not reduce, your legal rights as a consumer when you buy from a business. <a href={href("/how-buying-works")} className={linkClass}>How buying works</a></p>
              </div>
              <h3 className="mt-5 text-[20px] font-bold text-[#0B1220]">After-sales</h3>
              <div className="mt-2"><Copy value={vehicle.afterSales || settings.afterSales || NOT_PUBLISHED_COPY} /></div>
            </Section>

            <Section id="collection" title="Collection & delivery">
              <Copy value={vehicle.collectionDelivery || settings.collectionDelivery || NOT_PUBLISHED_COPY} />
            </Section>
          </div>
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="similar-heading" className="mt-6 border-t border-[#E3E8EF] pt-10">
            <SectionHeading id="similar-heading" title="Similar cars" eyebrow="Still available" />
            <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {similar.map((car: SaleVehicle) => <li key={car.id}><VehicleCard vehicle={car} href={href(`/cars/${car.slug}`)} /></li>)}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
