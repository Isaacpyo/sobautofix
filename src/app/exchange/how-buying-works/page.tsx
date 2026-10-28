import { CalendarClock, CreditCard, Handshake, LifeBuoy, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import { InfoHero, InfoSection, SettingsCopy, STATUTORY_RIGHTS_NOTE, Steps } from "@/components/exchange/info";
import { workshopPhotos } from "@/components/exchange/photos";
import { ButtonLink, Container, linkClass, Notice } from "@/components/exchange/ui";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeSettings } from "@/lib/exchange/settings";

export async function generateMetadata(): Promise<Metadata> {
  return exchangeMetadata({ title: "How buying works", description: "Viewing, payment, collection, after-sales and warranty when you buy a used car from SOB Autofix.", path: "/how-buying-works" });
}

export default async function HowBuyingWorksPage() {
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);
  const href = (path: string) => exchangeHref(base, path);
  return (
    <>
      <InfoHero eyebrow="Buying a car" title="How buying works" photo={workshopPhotos.buy} intro={<p>Everything is arranged with a member of our team. You can browse and send requests online, but we do not take payments or reservations online, and every viewing is confirmed by us personally.</p>} />
      <Container className="py-10 sm:py-14">
        <Steps items={[
          { title: "Browse", body: "Each listing shows the price, condition, known faults and inspection notes we hold." },
          { title: "Ask or request a viewing", body: "Send a question, or request a viewing time. A request is not a booking until we confirm it." },
          { title: "View the car", body: "Come and see the car at an agreed time. Ask anything you like." },
          { title: "Agree the sale with us", body: "We confirm the price, payment and how you will collect the car, directly with you." },
        ]} />
        {settings.buyingProcess && <div className="mt-8 max-w-3xl text-[16px] leading-7 text-[#344054]"><SettingsCopy value={settings.buyingProcess} /></div>}

        <div className="mt-12 max-w-3xl">
          <InfoSection id="viewing" title="Viewing a car" icon={<CalendarClock size={20} aria-hidden="true" />}>
            <SettingsCopy value={settings.viewingInformation} />
            <p className="mt-3">Viewing requests sent online are only requests. We will contact you to confirm a time, or suggest another one, before you travel.</p>
          </InfoSection>
          <InfoSection id="payment" title="Payment" icon={<CreditCard size={20} aria-hidden="true" />}>
            <Notice className="mb-4">We do not take payments, deposits or reservations online. Never pay anyone claiming to act for us without speaking to us first.</Notice>
            <SettingsCopy value={settings.paymentInformation} />
          </InfoSection>
          <InfoSection id="handover" title="Handover, collection and delivery" icon={<Truck size={20} aria-hidden="true" />}>
            <SettingsCopy value={settings.collectionDelivery} />
          </InfoSection>
          <InfoSection id="after-sales" title="After-sales" icon={<LifeBuoy size={20} aria-hidden="true" />}>
            <SettingsCopy value={settings.afterSales} />
          </InfoSection>
          <InfoSection id="warranty" title="Warranty and your statutory rights" icon={<ShieldCheck size={20} aria-hidden="true" />}>
            <h3 className="text-[20px] font-bold text-[#0B1220]">Warranty</h3>
            <p className="mt-1">Whether a car comes with a warranty is shown on its own listing. General information:</p>
            <SettingsCopy value={settings.warrantyInformation} className="mt-3" />
            <h3 className="mt-6 text-[20px] font-bold text-[#0B1220]">Your statutory rights</h3>
            <p className="mt-1">{STATUTORY_RIGHTS_NOTE} If you have questions about your rights, ask us before you buy, or see independent advice such as Citizens Advice.</p>
          </InfoSection>
          <InfoSection id="part-exchange" title="Part exchange" icon={<Handshake size={20} aria-hidden="true" />}>
            <p>You can offer your current car in part exchange. <a href={href("/part-exchange")} className={linkClass}>How part exchange works</a>.</p>
          </InfoSection>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={href("/cars")}>Browse cars</ButtonLink>
          <ButtonLink href={href("/contact")} variant="secondary">Contact us</ButtonLink>
        </div>
      </Container>
    </>
  );
}
