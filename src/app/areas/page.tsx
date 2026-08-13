import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionIntro } from "@/components/marketing/experience";
import { Container } from "@/components/ui/container";
import { areas } from "@/config/site";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Areas Covered from Doncaster", "SOB Autofix provides workshop and mobile automotive services across Doncaster and South Yorkshire.", "/areas");

export default function AreasPage() {
  return <><PageHero eyebrow="Areas covered" title="Workshop and mobile automotive support across Doncaster and South Yorkshire." body="Availability depends on the service, location and vehicle condition. Share the postcode when requesting mobile work or recovery." /><section className="py-20"><Container><SectionIntro eyebrow="Service coverage" title="Doncaster and surrounding areas" body="Workshop and mobile suitability varies by service. The postcode helps confirm the most practical route." /><div className="mt-10 grid gap-px overflow-hidden border border-[#E4EAF0] bg-[#E4EAF0] sm:grid-cols-2 lg:grid-cols-3">{areas.map((area, index) => index === 0 ? <Link key={area} href="/areas/doncaster" className="premium-card flex min-h-32 items-end justify-between bg-[#071127] p-5 font-bold text-white" data-reveal><span className="flex items-center gap-3"><MapPin className="text-[#67B9FF]" />{area}</span><span className="text-sm text-[#67B9FF]">View area →</span></Link> : <div key={area} className="flex min-h-32 items-end gap-3 bg-white p-5 font-semibold text-[#071127]" data-reveal><MapPin className="text-[#1974E2]" />{area}</div>)}</div><p className="mt-8 max-w-3xl leading-7 text-[#586575]">Only Doncaster currently has a dedicated area page. Additional area pages will be published after genuinely local, reviewed information is available.</p></Container></section></>;
}
