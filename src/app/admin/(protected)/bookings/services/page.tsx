import { ArrowLeft, CalendarCog, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { createAdminReadClient } from "@/lib/supabase/server";
import { ServiceMappingForm } from "./service-mapping-form";

type ServiceMappingRow = {
  id: string;
  service_key: string;
  display_name: string;
  description: string;
  provider_event_type_id: number | null;
  online_booking_enabled: boolean;
  location_mode: "workshop" | "mobile" | "both";
  sort_order: number;
};

export default async function BookingServicesPage() {
  const client = await createAdminReadClient();
  const { data } = client
    ? await client
      .from("booking_service_types")
      .select("id,service_key,display_name,description,provider_event_type_id,online_booking_enabled,location_mode,sort_order")
      .order("sort_order", { ascending: true })
    : { data: [] };
  const services = (data || []) as ServiceMappingRow[];
  const onlineCount = services.filter((service) => service.online_booking_enabled).length;

  return (
    <>
      <Link href="/admin/bookings" className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-extrabold text-[#1974E2] hover:underline">
        <ArrowLeft size={17} aria-hidden="true" /> Back to bookings
      </Link>
      <header className="mt-4 flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><CalendarCog size={23} aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Booking configuration</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#071127] sm:text-4xl">Service mappings</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667586]">Connect each approved SOB Autofix service to its calendar event type and choose where the appointment can take place.</p>
        </div>
      </header>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <Summary label="Services" value={services.length} />
        <Summary label="Online booking enabled" value={onlineCount} />
        <Summary label="Still disabled" value={services.length - onlineCount} />
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#BBD9FA] bg-[#F1F7FF] p-4 text-sm leading-6 text-[#1446A5]">
        <ShieldCheck className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
        <p>Event type IDs are scheduling references, not credentials. API keys and other secrets are never displayed or editable here.</p>
      </div>

      <div className="mt-7 grid gap-5">
        {services.map((service) => (
          <ServiceMappingForm
            key={service.id}
            service={{
              id: service.id,
              key: service.service_key,
              name: service.display_name,
              description: service.description,
              providerEventTypeId: service.provider_event_type_id,
              onlineBookingEnabled: service.online_booking_enabled,
              locationMode: service.location_mode,
            }}
          />
        ))}
        {!services.length && <p className="rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">No booking services have been configured.</p>}
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><p className="text-3xl font-extrabold text-[#071127]">{value}</p><p className="mt-1 text-sm font-bold text-[#667586]">{label}</p></article>;
}
