import type { Metadata } from "next";
import { InfoHero, InfoSection, SettingsCopy, Steps } from "@/components/exchange/info";
import { workshopPhotos } from "@/components/exchange/photos";
import { ButtonLink, Container, Notice } from "@/components/exchange/ui";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeSettings } from "@/lib/exchange/settings";

export async function generateMetadata(): Promise<Metadata> {
  return exchangeMetadata({ title: "Part exchange", description: "Part exchange your current car against a used car from SOB Autofix. Any valuation is subject to inspection and verification.", path: "/part-exchange" });
}

export default async function PartExchangePage() {
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);
  const href = (path: string) => exchangeHref(base, path);
  return (
    <>
      <InfoHero eyebrow="Part exchange" title="Part exchange your car" photo={workshopPhotos.partExchange} intro={<p>Found a car you like? Tell us about your current car and we will look at what we can offer towards it.</p>}>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={href("/cars")}>Choose a car first</ButtonLink>
          <ButtonLink href={href("/sell")} variant="secondary">Tell us about your car</ButtonLink>
        </div>
      </InfoHero>
      <Container className="py-10 sm:py-14">
        <Steps items={[
          { title: "Choose a car", body: "On any listed car, tap Part Exchange Your Car. The car you want is attached to your enquiry." },
          { title: "Tell us about yours", body: "Registration, mileage, condition and a few photos. “Not sure” is fine for anything you do not know." },
          { title: "We review it", body: "We contact you to talk through your car and the one you want." },
          { title: "Inspection", body: "Any figure we give is provisional until we have seen your car and checked its documents and history." },
        ]} />
        <div className="mt-12 max-w-3xl">
          <InfoSection id="details" title="Part exchange details">
            <SettingsCopy value={settings.partExchangeInformation} />
          </InfoSection>
          <Notice>A part exchange enquiry does not reserve the car you want. Ask us if you would like to discuss holding a car.</Notice>
        </div>
      </Container>
    </>
  );
}
