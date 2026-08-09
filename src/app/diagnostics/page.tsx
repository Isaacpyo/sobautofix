import { Activity, Binary, Cable, ScanLine } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ServiceCard } from "@/components/marketing/service-card";
import { VehicleJourney } from "@/components/vehicle/vehicle-journey";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { diagnostics } from "@/config/site";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Professional Vehicle Diagnostics in Doncaster", "Professional vehicle diagnostics and electrical fault finding in Doncaster for warning lights, ECU, ABS, DPF, battery and module faults.", "/diagnostics");

export default function DiagnosticsPage() {
  return <><PageHero eyebrow="Professional vehicle diagnostics" title="Diagnosis built on evidence—not assumptions." body="System scans reveal useful clues. Targeted testing turns those clues into a reasoned next step."><VehicleJourney compact source="diagnostics-hub" /></PageHero><section className="py-20"><Container><div className="max-w-3xl"><Eyebrow>Diagnostic capability</Eyebrow><h2 className="text-5xl font-extrabold text-[#071127]">From warning light to underlying fault.</h2><p className="mt-5 text-lg leading-8 text-[#586575]">Modern vehicle systems share sensors, power supplies and communication networks. We look beyond a single code to understand the conditions that produced it.</p></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{diagnostics.filter((item) => item.published).map((item) => <ServiceCard key={item.slug} title={item.name} body={item.summary} href={`/diagnostics/${item.slug}`} />)}</div></Container></section><section className="diagnostic-panel py-20 text-white"><Container><Eyebrow className="text-[#67B9FF]">The diagnostic process</Eyebrow><h2 className="text-5xl font-extrabold">A scan is one step in the investigation.</h2><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Process icon={<Activity />} title="Understand" body="Confirm symptoms, conditions and recent work." /><Process icon={<ScanLine />} title="Scan" body="Interrogate the relevant control systems." /><Process icon={<Cable />} title="Test" body="Check electrical and mechanical evidence." /><Process icon={<Binary />} title="Explain" body="Set out the fault and recommended next step." /></div><ButtonLink className="mt-10" href="/book">Book diagnostics</ButtonLink></Container></section></>;
}

function Process({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <article className="rounded-2xl border border-[#1974E2]/25 bg-white/5 p-6"><span className="text-[#168BFF]">{icon}</span><h3 className="mt-8 text-2xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#B7C5D7]">{body}</p></article>; }
