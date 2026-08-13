import {
  ArrowLeft,
  CalendarClock,
  CarFront,
  Clock3,
  History,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { BookingStatus, ProviderSyncState } from "@/lib/bookings/types";
import { createAdminReadClient as createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatRegistration } from "@/lib/vehicle/registration-format";
import { AdminBookingControls } from "./booking-controls";

type Customer = { name: string; email: string | null; phone: string | null };
type Vehicle = {
  registration: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  colour: string | null;
  fuel_type: string | null;
  transmission: string | null;
};
type AuditEntry = {
  id: number;
  action: string;
  actor_type: "customer" | "provider" | "admin" | "system";
  detail: unknown;
  created_at: string;
};
type AdminBookingDetail = {
  id: string;
  booking_reference: string;
  status: BookingStatus;
  service_key: string | null;
  service_name: string;
  problem_description: string | null;
  symptoms: unknown;
  conditional_answers: unknown;
  appointment_start: string;
  appointment_end: string | null;
  original_appointment_start: string;
  original_appointment_end: string | null;
  timezone: string;
  location_mode: "workshop" | "mobile" | null;
  location: string | null;
  service_address: string | null;
  service_postcode: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  provider_sync_state: ProviderSyncState;
  provider_event_updated_at: string | null;
  created_at: string;
  updated_at: string;
  last_modified_at: string;
  customers: Customer | Customer[] | null;
  vehicles: Vehicle | Vehicle[] | null;
  booking_audit_log: AuditEntry[] | null;
};

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const client = await createClient();
  if (!client) notFound();
  const { data, error } = await client
    .from("bookings")
    .select("id,booking_reference,status,service_key,service_name,problem_description,symptoms,conditional_answers,appointment_start,appointment_end,original_appointment_start,original_appointment_end,timezone,location_mode,location,service_address,service_postcode,notes,cancellation_reason,cancelled_at,provider_sync_state,provider_event_updated_at,created_at,updated_at,last_modified_at,customers(name,email,phone),vehicles(registration,make,model,year,colour,fuel_type,transmission),booking_audit_log(id,action,actor_type,detail,created_at)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();

  const booking = data as unknown as AdminBookingDetail;
  const customer = relation(booking.customers);
  const vehicle = relation(booking.vehicles);
  const symptoms = safeStringArray(booking.symptoms);
  const answers = safeConditionalAnswers(booking.conditional_answers);
  const history = [...(booking.booking_audit_log || [])].sort((left, right) => right.created_at.localeCompare(left.created_at));

  return (
    <>
      <Link href="/admin/bookings" className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-extrabold text-[#1974E2] hover:underline">
        <ArrowLeft size={17} aria-hidden="true" /> Back to bookings
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-sm font-black tracking-[.12em] text-[#1974E2]">{booking.booking_reference}</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#071127] sm:text-4xl">{customer?.name || "Customer booking"}</h1>
          <p className="mt-2 text-[#667586]">{booking.service_name} · {formatAppointmentRange(booking.appointment_start, booking.appointment_end)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={booking.status} />
          <SyncStateBadge state={booking.provider_sync_state} />
        </div>
      </header>

      {booking.provider_sync_state === "failed" && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <strong>Calendar sync needs attention.</strong> Check the appointment before promising any further change to the customer.
        </div>
      )}

      {booking.cancellation_reason && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
          <strong>Cancellation note:</strong> {booking.cancellation_reason}
          {booking.cancelled_at && <span className="block text-xs text-red-800">Cancelled {formatDateTime(booking.cancelled_at)}</span>}
        </div>
      )}

      <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.72fr)]">
        <div className="grid min-w-0 gap-6">
          <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="customer-vehicle-heading">
            <h2 id="customer-vehicle-heading" className="text-xl font-extrabold text-[#071127]">Customer and vehicle</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <DetailBlock icon={UserRound} title="Customer">
                <p className="font-extrabold text-[#071127]">{customer?.name || "Not recorded"}</p>
                {customer?.email && <a href={`mailto:${customer.email}`} className="mt-2 flex min-h-8 items-center gap-2 break-all text-sm font-semibold text-[#1974E2] hover:underline"><Mail size={15} aria-hidden="true" />{customer.email}</a>}
                {customer?.phone && <a href={`tel:${customer.phone}`} className="mt-1 flex min-h-8 items-center gap-2 text-sm font-semibold text-[#1974E2] hover:underline"><Phone size={15} aria-hidden="true" />{customer.phone}</a>}
              </DetailBlock>
              <DetailBlock icon={CarFront} title="Vehicle">
                {vehicle?.registration && <p className="inline-block rounded-md bg-[#F4C542] px-2 py-1 font-mono font-black tracking-[.1em] text-black">{formatRegistration(vehicle.registration)}</p>}
                <p className="mt-2 font-extrabold text-[#071127]">{[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle details not recorded"}</p>
                <p className="mt-1 text-sm leading-6 text-[#667586]">{[vehicle?.year, vehicle?.colour, vehicle?.fuel_type, vehicle?.transmission].filter(Boolean).join(" · ")}</p>
              </DetailBlock>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="service-problem-heading">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><Wrench size={19} aria-hidden="true" /></span><div><h2 id="service-problem-heading" className="text-xl font-extrabold text-[#071127]">Service and problem details</h2><p className="mt-1 font-semibold text-[#586575]">{booking.service_name}</p></div></div>
            <div className="mt-5 rounded-xl bg-[#F4F7FA] p-4">
              <p className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">Customer description</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#071127]">{booking.problem_description || booking.notes || "No problem description was supplied."}</p>
            </div>
            {symptoms.length > 0 && <div className="mt-5"><p className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">Reported symptoms</p><ul className="mt-2 flex flex-wrap gap-2">{symptoms.map((symptom) => <li key={symptom} className="rounded-full bg-[#EAF3FF] px-3 py-1.5 text-xs font-bold text-[#1446A5]">{symptom}</li>)}</ul></div>}
            {answers.length > 0 && <dl className="mt-5 grid gap-4 sm:grid-cols-2">{answers.map((answer) => <div key={answer.label}><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{answer.label}</dt><dd className="mt-1 text-sm font-semibold text-[#071127]">{answer.value}</dd></div>)}</dl>}
          </section>

          <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="location-heading">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><MapPin size={19} aria-hidden="true" /></span><div className="min-w-0"><h2 id="location-heading" className="text-xl font-extrabold text-[#071127]">Service location</h2><p className="mt-1 font-bold capitalize text-[#586575]">{booking.location_mode === "mobile" ? "Mobile appointment" : booking.location_mode === "workshop" ? "Workshop appointment" : "Recorded location"}</p></div></div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#071127]">{locationText(booking)}</p>
          </section>
        </div>

        <aside className="grid min-w-0 content-start gap-6">
          <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="appointment-heading">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><CalendarClock size={19} aria-hidden="true" /></span><h2 id="appointment-heading" className="pt-1 text-xl font-extrabold text-[#071127]">Appointment</h2></div>
            <dl className="mt-6 grid gap-5">
              <DetailItem label="Current appointment" value={formatAppointmentRange(booking.appointment_start, booking.appointment_end)} />
              <DetailItem label="Original appointment" value={formatAppointmentRange(booking.original_appointment_start, booking.original_appointment_end)} />
              <DetailItem label="Display timezone" value={booking.timezone === "Europe/London" ? "UK time (Europe/London)" : booking.timezone} />
            </dl>
          </section>

          <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="record-heading">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EEF1F7] text-[#1446A5]"><Clock3 size={19} aria-hidden="true" /></span><h2 id="record-heading" className="pt-1 text-xl font-extrabold text-[#071127]">Booking record</h2></div>
            <dl className="mt-6 grid gap-5">
              <div><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">Status</dt><dd className="mt-2"><BookingStatusBadge status={booking.status} /></dd></div>
              <div><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">Calendar sync</dt><dd className="mt-2"><SyncStateBadge state={booking.provider_sync_state} /></dd></div>
              <DetailItem label="Created" value={formatDateTime(booking.created_at)} />
              <DetailItem label="Updated" value={formatDateTime(booking.updated_at)} />
              <DetailItem label="Last modified" value={formatDateTime(booking.last_modified_at || booking.updated_at)} />
              {booking.provider_event_updated_at && <DetailItem label="Last calendar update" value={formatDateTime(booking.provider_event_updated_at)} />}
            </dl>
          </section>

          <AdminBookingControls bookingId={booking.id} status={booking.status} currentAppointmentStart={booking.appointment_start} />
        </aside>
      </div>

      <section className="mt-6 rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="history-heading">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EEF1F7] text-[#1446A5]"><History size={19} aria-hidden="true" /></span><div><h2 id="history-heading" className="text-xl font-extrabold text-[#071127]">Booking history</h2><p className="mt-1 text-sm text-[#667586]">A chronological record of customer, staff and calendar changes.</p></div></div>
        {history.length > 0 ? (
          <ol className="mt-6 grid gap-3">
            {history.map((entry) => {
              const detail = safeHistoryDetail(entry.detail);
              return (
                <li key={entry.id} className="grid gap-2 rounded-xl border border-[#E4EAF0] p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div><p className="font-extrabold text-[#071127]">{historyTitle(entry.action)}</p>{detail && <p className="mt-1 text-sm leading-6 text-[#586575]">{detail}</p>}<p className="mt-2 text-xs font-bold text-[#667586]">By {actorLabel(entry.actor_type)}</p></div>
                  <time dateTime={entry.created_at} className="text-xs font-semibold text-[#667586] sm:text-right">{formatDateTime(entry.created_at)}</time>
                </li>
              );
            })}
          </ol>
        ) : <p className="mt-6 rounded-xl bg-[#F4F7FA] p-4 text-sm text-[#667586]">No history entries have been recorded.</p>}
      </section>
    </>
  );
}

function DetailBlock({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F1F7FF] text-[#1974E2]"><Icon size={19} aria-hidden="true" /></span><div className="min-w-0"><p className="mb-2 text-xs font-extrabold tracking-wide text-[#667586] uppercase">{title}</p>{children}</div></div>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{label}</dt><dd className="mt-1 text-sm font-bold leading-6 text-[#071127]">{value}</dd></div>;
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    pending: "bg-amber-100 text-amber-900",
    confirmed: "bg-green-100 text-green-800",
    rescheduled: "bg-[#EAF3FF] text-[#1446A5]",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-[#E4EAF0] text-[#586575]",
  };
  return <span className={cn("inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold capitalize", styles[status])}>{status}</span>;
}

function SyncStateBadge({ state }: { state: ProviderSyncState }) {
  const details: Record<ProviderSyncState, { label: string; className: string; icon: typeof RefreshCcw }> = {
    synced: { label: "Synced", className: "bg-green-100 text-green-800", icon: RefreshCcw },
    pending: { label: "Pending sync", className: "bg-amber-100 text-amber-900", icon: Clock3 },
    failed: { label: "Sync failed", className: "bg-red-100 text-red-800", icon: RefreshCcw },
  };
  const Icon = details[state].icon;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold", details[state].className)}><Icon size={13} aria-hidden="true" />{details[state].label}</span>;
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

function safeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 10) : [];
}

function safeConditionalAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const answers = value as Record<string, unknown>;
  const labels: Record<string, string> = {
    mileage: "Current mileage",
    warningLight: "Warning light",
    issueTiming: "When it happens",
    vehicleAccessible: "Vehicle access",
  };
  return Object.entries(labels).flatMap(([key, label]) => {
    const answer = answers[key];
    return typeof answer === "string" && answer.trim() ? [{ label, value: answer.trim() }] : [];
  });
}

function safeHistoryDetail(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const detail = value as Record<string, unknown>;
  const previous = typeof detail.previousAppointmentStart === "string" && Number.isFinite(Date.parse(detail.previousAppointmentStart)) ? detail.previousAppointmentStart : null;
  const current = typeof detail.appointmentStart === "string" && Number.isFinite(Date.parse(detail.appointmentStart)) ? detail.appointmentStart : null;
  if (previous && current) return `${formatDateTime(previous)} → ${formatDateTime(current)}`;
  if (current) return `Appointment: ${formatDateTime(current)}`;
  if (previous) return `Previous appointment: ${formatDateTime(previous)}`;
  return null;
}

function historyTitle(action: string) {
  const titles: Record<string, string> = {
    created: "Booking created",
    confirmed: "Appointment confirmed",
    reschedule_started: "Reschedule started",
    rescheduled: "Appointment rescheduled",
    cancelled: "Booking cancelled",
    completed: "Appointment completed",
    provider_synced: "Calendar synced",
    provider_sync_failed: "Calendar sync needs attention",
    notification_sent: "Customer update sent",
    notification_failed: "Customer update needs attention",
  };
  return titles[action] || "Booking updated";
}

function actorLabel(actor: AuditEntry["actor_type"]) {
  return { customer: "customer", provider: "calendar", admin: "staff", system: "system" }[actor];
}

function locationText(booking: AdminBookingDetail) {
  if (booking.location) return booking.location;
  return [booking.service_address, booking.service_postcode].filter(Boolean).join(", ") || "No location was recorded.";
}

function formatAppointmentRange(startValue: string, endValue: string | null) {
  const start = new Date(startValue);
  const startText = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(start);
  if (!endValue) return startText;
  const end = new Date(endValue);
  const sameDate = dateKey(start) === dateKey(end);
  const endText = new Intl.DateTimeFormat("en-GB", sameDate
    ? { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }
    : { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(end);
  return `${startText} – ${endText}`;
}

function dateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/London" }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}
