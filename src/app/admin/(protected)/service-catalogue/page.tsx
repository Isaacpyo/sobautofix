import { CalendarSync, Wrench } from "lucide-react";
import Link from "next/link";
import { listServiceCatalogue } from "@/lib/service-catalogue/repository";
import { CatalogueEditor } from "./catalogue-editor";

export default async function AdminServiceCataloguePage() {
  const systems = await listServiceCatalogue();
  const serviceCount = systems.reduce((total, system) => total + system.services.length, 0);
  const bookableCount = systems.reduce((total, system) => total + system.services.filter((service) => service.onlineBookingEnabled).length, 0);

  return <>
    <header className="flex flex-wrap items-start justify-between gap-5">
      <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><Wrench size={23} /></span><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Shared configuration</p><h1 className="mt-1 text-4xl font-extrabold text-[#071127]">Service catalogue</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#667586]">Manage vehicle systems and the services beneath them once. Saved changes synchronise with customer booking, invoice creation and the public services catalogue.</p></div></div>
      <Link href="/admin/bookings/services" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#BCD6F6] bg-white px-4 text-sm font-extrabold text-[#1446A5]"><CalendarSync size={17} /> Calendar mapping view</Link>
    </header>
    <div className="mt-7 grid gap-4 sm:grid-cols-3"><Summary label="Vehicle systems" value={systems.length} /><Summary label="Catalogue services" value={serviceCount} /><Summary label="Online booking" value={bookableCount} /></div>
    <CatalogueEditor systems={systems} />
  </>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><p className="text-3xl font-extrabold text-[#071127]">{value}</p><p className="mt-1 text-sm font-bold text-[#667586]">{label}</p></article>;
}
