import { Camera, ClipboardCheck, Handshake } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { workshopPhotos } from "@/components/exchange/photos";
import { SellForm } from "@/components/exchange/sell/sell-form";
import { Container, Eyebrow } from "@/components/exchange/ui";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { vehicleName } from "@/lib/exchange/public/format";
import { formatUkPhone, mainSiteHref, telHref, whatsappHref } from "@/lib/exchange/public/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeVehicle } from "@/lib/exchange/public/stock";
import { getExchangeSettings } from "@/lib/exchange/settings";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  return exchangeMetadata({
    title: params.vehicle ? "Part exchange your car" : "Sell your car",
    description: "Tell SOB Autofix about your car in five short steps and add photos from your phone. Any offer is subject to inspection and verification.",
    path: "/sell",
    index: params.vehicle ? false : undefined,
  });
}

export default async function SellPage({ searchParams }: Props) {
  const [base, settings, params] = await Promise.all([getExchangeBase(), getExchangeSettings(), searchParams]);
  const slug = typeof params.vehicle === "string" ? params.vehicle : undefined;
  const target = slug ? (await getExchangeVehicle(slug)).vehicle : null;
  const interested = target && (target.status === "available" || target.status === "reserved")
    ? { id: target.id, slug: target.slug, name: vehicleName(target), derivative: target.derivative, price: target.price }
    : undefined;

  return (
    <>
      <section className="border-b border-[#E3E8EF] bg-[#F3F5F8]">
        <Container className="grid items-center gap-6 py-7 sm:py-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Eyebrow>{interested ? "Part exchange" : "Sell your car"}</Eyebrow>
            <h1 className="mt-1 text-[40px] leading-none font-bold text-[#0B1220] sm:text-[52px]">{interested ? "Part exchange your car" : "Sell your car to us"}</h1>
            <p className="mt-3 max-w-2xl text-[17px] leading-7 text-[#344054]">
              Five short steps: your car, its condition, photos, your details, then check and send. You can go back and change anything before you send it.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-[#344054]">
              <li className="flex items-center gap-2"><ClipboardCheck size={18} aria-hidden="true" className="text-[#1462C4]" /> &ldquo;Not sure&rdquo; is always fine</li>
              <li className="flex items-center gap-2"><Camera size={18} aria-hidden="true" className="text-[#1462C4]" /> Photos straight from your phone</li>
              <li className="flex items-center gap-2"><Handshake size={18} aria-hidden="true" className="text-[#1462C4]" /> No commitment to sell</li>
            </ul>
          </div>
          <div className="relative hidden aspect-[16/10] overflow-hidden rounded-3xl lg:block">
            <Image src={workshopPhotos.partExchange.src} alt={workshopPhotos.partExchange.alt} fill sizes="420px" className="object-cover object-[50%_35%]" />
          </div>
        </Container>
      </section>
      <Container className="max-w-[880px] py-8 sm:py-10">
        {slug && !interested && (
          <p className="mb-6 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-[15px] text-[#93370D]" role="status">The car you wanted to part exchange against is no longer listed. You can still tell us about your car, and we will talk through the options.</p>
        )}
        <SellForm
          interestedVehicle={interested}
          contact={{ phoneHref: telHref(settings.phone), phoneLabel: formatUkPhone(settings.phone), whatsappHref: whatsappHref(settings.whatsapp), email: settings.email }}
          links={{ privacyHref: mainSiteHref(base, "/privacy"), sellerPrivacyHref: exchangeHref(base, "/policies/selling-your-car-privacy") }}
          responsePromise={settings.sellerResponsePromise}
        />
      </Container>
    </>
  );
}
