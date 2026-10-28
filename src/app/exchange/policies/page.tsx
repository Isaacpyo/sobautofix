import { ChevronRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InfoHero } from "@/components/exchange/info";
import { Container } from "@/components/exchange/ui";
import { exchangePolicyPages } from "@/config/exchange";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";
import { mainSiteHref } from "@/lib/exchange/public/links";
import { exchangeMetadata } from "@/lib/exchange/public/metadata";
import { getExchangeSettings } from "@/lib/exchange/settings";

export async function generateMetadata(): Promise<Metadata> {
  return exchangeMetadata({ title: "Policies", path: "/policies" });
}

export default async function PoliciesPage() {
  const [base, settings] = await Promise.all([getExchangeBase(), getExchangeSettings()]);
  return (
    <>
      <InfoHero eyebrow="Policies" title="Policies and terms" intro={<p>The terms that apply when you buy a car from us or sell one to us.</p>} />
      <Container className="max-w-3xl py-10">
        <ul className="divide-y divide-[#E3E8EF] overflow-hidden rounded-2xl border border-[#E3E8EF]">
          {exchangePolicyPages.map((page) => {
            const published = Boolean(settings.policies[page.key]?.trim());
            return (
              <li key={page.slug}>
                <Link href={exchangeHref(base, `/policies/${page.slug}`)} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-[#F3F5F8]">
                  <FileText size={20} aria-hidden="true" className="shrink-0 text-[#1462C4]" />
                  <span className="flex-1"><span className="block font-semibold text-[#0B1220]">{page.title}</span><span className="text-sm text-[#5B6575]">{published ? "Published" : "Being finalised"}</span></span>
                  <ChevronRight size={18} aria-hidden="true" className="text-[#5B6575]" />
                </Link>
              </li>
            );
          })}
          <li>
            <a href={mainSiteHref(base, "/privacy")} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-[#F3F5F8]">
              <FileText size={20} aria-hidden="true" className="shrink-0 text-[#1462C4]" />
              <span className="flex-1"><span className="block font-semibold text-[#0B1220]">Privacy notice</span><span className="text-sm text-[#5B6575]">{settings.workshopName}</span></span>
              <ChevronRight size={18} aria-hidden="true" className="text-[#5B6575]" />
            </a>
          </li>
        </ul>
      </Container>
    </>
  );
}
