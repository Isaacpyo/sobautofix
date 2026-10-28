import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoHero, SettingsCopy } from "@/components/exchange/info";
import { Container, linkClass } from "@/components/exchange/ui";
import { exchangePolicyPages } from "@/config/exchange";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeSettings } from "@/lib/exchange/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = exchangePolicyPages.find((candidate) => candidate.slug === slug);
  if (!page) return exchangeMetadata({ title: "Policy not found", path: `/policies/${slug}`, index: false });
  const settings = await getExchangeSettings();
  // Unpublished policies show a holding message only, so keep them out of search results.
  return exchangeMetadata({ title: page.title, path: `/policies/${page.slug}`, index: settings.policies[page.key]?.trim() ? undefined : false });
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const page = exchangePolicyPages.find((candidate) => candidate.slug === slug);
  if (!page) notFound();
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);
  return (
    <>
      <InfoHero eyebrow="Policy" title={page.title} />
      <Container className="max-w-3xl py-10 text-[16px] leading-7 text-[#344054]">
        <SettingsCopy value={settings.policies[page.key]} />
        <p className="mt-8"><a href={exchangeHref(base, "/policies")} className={linkClass}>All policies</a></p>
      </Container>
    </>
  );
}
