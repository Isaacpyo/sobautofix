import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Automotive Advice", robots: { index: false, follow: true } };
export default function AdvicePage() { return <><PageHero eyebrow="Automotive advice" title="Evidence-led guides are being prepared." body="The publishing architecture is ready, but articles will not be indexed until each guide is genuinely useful and approved." cta={false} /><section className="py-20"><Container className="text-center"><BookOpen className="mx-auto text-[#1974E2]" size={44} /><h2 className="mt-4 text-3xl font-bold text-[#071127]">No low-value filler</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-[#586575]">Future guides will focus on diagnostics, warning lights, electrical problems, maintenance and buying a used car.</p></Container></section></>; }
