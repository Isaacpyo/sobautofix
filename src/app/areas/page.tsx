import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Container, Eyebrow } from "@/components/ui/container";
import { areas } from "@/config/site";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Areas Covered from Doncaster", "SOB Autofix provides workshop and mobile automotive services from Norton across Doncaster and surrounding areas.", "/areas");

export default function AreasPage() {
  return <><PageHero eyebrow="Areas covered" title="Workshop and mobile automotive support from Norton." body="Availability depends on the service, location and vehicle condition. Share the postcode when requesting mobile work or recovery." /><section className="py-20"><Container><Eyebrow>Service coverage</Eyebrow><h2 className="text-4xl font-extrabold text-[#071127]">Doncaster and surrounding areas</h2><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{areas.map((area, index) => index === 0 ? <Link key={area} href="/areas/doncaster" className="flex items-center justify-between rounded-2xl border border-[#1974E2]/30 bg-[#EAF3FF] p-5 font-bold text-[#071127]"><span className="flex items-center gap-3"><MapPin className="text-[#1974E2]" />{area}</span><span className="text-sm text-[#1974E2]">View area →</span></Link> : <div key={area} className="flex items-center gap-3 rounded-2xl border border-[#E4EAF0] bg-white p-5 font-semibold text-[#071127]"><MapPin className="text-[#1974E2]" />{area}</div>)}</div><p className="mt-8 max-w-3xl leading-7 text-[#586575]">Only Doncaster currently has a dedicated area page. Additional area pages will be published after genuinely local, reviewed information is available.</p></Container></section></>;
}
