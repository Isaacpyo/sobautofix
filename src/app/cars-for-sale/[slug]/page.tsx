import type { Metadata } from "next";
import { MessageCircle, Phone } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { VehicleEnquiryModal } from "@/components/sales/vehicle-enquiry-modal";
import { VehicleImageGallery } from "@/components/sales/vehicle-image-gallery";
import { JsonLd } from "@/components/seo/json-ld";
import { Container, Eyebrow } from "@/components/ui/container";
import { contactLinks, siteConfig } from "@/config/site";
import { getSaleVehicle, isSoldPageExpired } from "@/lib/sales/repository";
import { createMetadata } from "@/lib/seo";
import { formatCurrency } from "@/lib/utils";
import type { SaleVehicle } from "@/types/domain";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const vehicle = await getSaleVehicle((await params).slug);
  if (!vehicle) return {};
  const metadata = createMetadata(
    `${vehicle.year} ${vehicle.make} ${vehicle.model} for Sale`,
    `${vehicle.year} ${vehicle.make} ${vehicle.model}, ${vehicle.mileage.toLocaleString("en-GB")} miles, ${vehicle.fuelType}, ${vehicle.transmission}.`,
    `/cars-for-sale/${vehicle.slug}`,
  );
  if (vehicle.status === "sold")
    metadata.robots = { index: false, follow: true };
  return metadata;
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const vehicle = await getSaleVehicle((await params).slug);
  if (!vehicle) notFound();
  if (isSoldPageExpired(vehicle)) permanentRedirect("/cars-for-sale");
  const specs = [
    ["Mileage", `${vehicle.mileage.toLocaleString("en-GB")} miles`],
    ["Fuel", vehicle.fuelType],
    ["Transmission", vehicle.transmission],
    ["Engine", vehicle.engineSize],
    ["Colour", vehicle.colour],
    ["Year", String(vehicle.year)],
  ].filter((item) => item[1]);
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <>
      <JsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "Vehicle",
          name: vehicleName,
          url: `${siteConfig.siteUrl}/cars-for-sale/${vehicle.slug}`,
          mileageFromOdometer: {
            "@type": "QuantitativeValue",
            value: vehicle.mileage,
            unitCode: "SMI",
          },
          fuelType: vehicle.fuelType,
          vehicleTransmission: vehicle.transmission,
          offers: {
            "@type": "Offer",
            priceCurrency: "GBP",
            price: vehicle.price,
            availability:
              vehicle.status === "available"
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
          },
        }}
      />
      <section className="hero-grid relative overflow-hidden py-12 text-white sm:py-16">
        <Container>
          <Eyebrow className="text-[#67B9FF]">
            Vehicle sales / {vehicle.year}
          </Eyebrow>
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div className="order-2 md:order-1">
              <h1 className="text-balance text-5xl leading-[.9] font-extrabold sm:text-6xl lg:text-7xl">
                {vehicle.make}{" "}
                <span className="text-[#67B9FF]">{vehicle.model}</span>
              </h1>
              <p className="mt-3 text-[#C6D2DF]">{vehicle.derivative}</p>
            </div>
            <div className="order-1 border-l-2 border-[#1974E2] pl-5 md:order-2">
              <strong className="block text-4xl font-black">
                {formatCurrency(vehicle.price)}
              </strong>
              {vehicle.status !== "available" && (
                <span className="mt-2 inline-block bg-white px-3 py-1 text-xs font-black text-[#071127] uppercase">
                  {vehicle.status}
                </span>
              )}
            </div>
          </div>
        </Container>
      </section>
      <section className="py-10 sm:py-14">
        <Container>
          <VehicleImageGallery images={vehicle.images} vehicleName={vehicleName} />
          <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_.65fr]">
            <div>
              <Eyebrow>Vehicle details</Eyebrow>
              <h2 className="text-4xl font-extrabold text-[#071127]">
                The approved listing information.
              </h2>
              <p className="mt-5 leading-8 text-[#586575]">
                {vehicle.description}
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-[#E4EAF0] bg-[#E4EAF0] sm:grid-cols-3">
                {specs.map(([label, value]) => (
                  <div key={label} className="bg-[#F4F7FA] p-4">
                    <dt className="text-xs font-bold text-[#667586] uppercase">
                      {label}
                    </dt>
                    <dd className="mt-1 font-bold text-[#071127]">{value}</dd>
                  </div>
                ))}
              </dl>
              {vehicle.features.length > 0 && (
                <>
                  <h2 className="mt-10 text-3xl font-bold text-[#071127]">
                    Features
                  </h2>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {vehicle.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-[#586575]">
                        <span className="text-[#1974E2]">—</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <VehicleBuyingInformation vehicle={vehicle} vehicleName={vehicleName} className="mt-10 lg:hidden" />
            </div>
            <VehicleBuyingInformation vehicle={vehicle} vehicleName={vehicleName} className="hidden lg:sticky lg:top-28 lg:block" />
          </div>
        </Container>
      </section>
    </>
  );
}

function VehicleBuyingInformation({ vehicle, vehicleName, className }: { vehicle: SaleVehicle; vehicleName: string; className: string }) {
  const contactClassName = "inline-flex min-h-12 items-center justify-center rounded-lg border border-[#1974E2]/25 bg-transparent text-[#1974E2] shadow-[0_4px_12px_rgba(7,17,39,.08)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/25";

  return (
    <aside className={`h-fit rounded-[1.75rem_.35rem_1.75rem_.35rem] border border-[#1974E2]/20 bg-[#EAF3FF] p-6 text-[#071127] ${className}`}>
      <h2 className="text-2xl font-bold">Buying information</h2>
      <p className="mt-4 text-sm leading-6 text-[#586575]">
        {vehicle.financeAvailable
          ? "Finance options may be available on this vehicle. Contact us for details."
          : "Finance options are not currently advertised for this vehicle. Contact us if you would like to discuss the available options."}
      </p>
      <p className="mt-3 text-sm leading-6 text-[#586575]">
        {vehicle.warranty?.available
          ? vehicle.warranty.description || "Warranty information is available on request."
          : "Warranty details are not currently listed. We will confirm any applicable cover before you arrange a viewing."}
      </p>
      <div className="mt-6 grid gap-3">
        {vehicle.status !== "sold" && <VehicleEnquiryModal vehicleSlug={vehicle.slug} vehicleName={vehicleName} />}
        <div className="grid grid-cols-2 gap-3">
          <a href={contactLinks.phone} aria-label="Call about this vehicle" className={contactClassName} title="Call about this vehicle"><Phone size={21} aria-hidden="true" /></a>
          <a href={contactLinks.whatsapp} aria-label="WhatsApp about this vehicle" className={contactClassName} title="WhatsApp about this vehicle"><MessageCircle size={21} aria-hidden="true" /></a>
        </div>
      </div>
    </aside>
  );
}
