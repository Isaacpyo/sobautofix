import { ArrowUpRight, CircuitBoard, Cog, Gauge, Wrench } from "lucide-react";
import Link from "next/link";

const icons = { diagnostic: CircuitBoard, repair: Wrench, service: Cog, inspection: Gauge };

export function ServiceCard({ title, body, href, icon = "diagnostic", dark = false }: { title: string; body: string; href: string; icon?: keyof typeof icons; dark?: boolean }) {
  const Icon = icons[icon];
  return (
    <Link href={href} className={dark ? "group rounded-2xl border border-[#1974E2]/25 bg-[#071127] p-6 text-white transition hover:-translate-y-1 hover:border-[#1974E2]" : "group rounded-2xl border border-[#E4EAF0] bg-white p-6 transition hover:-translate-y-1 hover:border-[#1974E2]/50 hover:shadow-xl"}>
      <div className="flex items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1974E2]/12 text-[#168BFF]"><Icon /></span><ArrowUpRight className="text-[#9AA7B6] transition group-hover:text-[#168BFF]" /></div>
      <h3 className="mt-6 text-2xl font-bold">{title}</h3>
      <p className={dark ? "mt-3 text-sm leading-6 text-[#B7C5D7]" : "mt-3 text-sm leading-6 text-[#586575]"}>{body}</p>
    </Link>
  );
}
