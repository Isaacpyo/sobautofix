import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { AdminListFilters, AdminPagination } from "@/components/admin/admin-list-controls";
import type { BookingStatus, ProviderSyncState } from "@/lib/bookings/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatRegistration } from "@/lib/vehicle/registration-format";

type AdminBookingListRow = {
  id: string;
  booking_reference: string;
  status: BookingStatus;
  service_name: string;
  appointment_start: string;
  location_mode: "workshop" | "mobile" | null;
  location: string | null;
  provider_sync_state: ProviderSyncState;
  customers: { name: string; email: string | null } | Array<{ name: string; email: string | null }> | null;
  vehicles: { registration: string | null; make: string | null; model: string | null } | Array<{ registration: string | null; make: string | null; model: string | null }> | null;
};

const activeStatuses: BookingStatus[] = ["pending", "confirmed", "rescheduled"];
const pageSize = 20;

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const status = params.status || "";
  const requestedPage = positivePage(params.page);
  const client = await createClient();
  const now = new Date();
  const today = dateKeyInLondon(now);
  const tomorrow = addUtcDays(today, 1);
  const todayStart = londonMidnight(today);
  const tomorrowStart = londonMidnight(tomorrow);

  const results = client ? await Promise.all([
    client
      .from("bookings")
      .select("id,booking_reference,status,service_name,appointment_start,location_mode,location,provider_sync_state,customers(name,email),vehicles(registration,make,model)")
      .order("appointment_start", { ascending: false })
      .limit(250),
    client.from("bookings").select("id", { count: "exact", head: true }).gte("appointment_start", todayStart).lt("appointment_start", tomorrowStart).neq("status", "cancelled"),
    client.from("bookings").select("id", { count: "exact", head: true }).gte("appointment_start", now.toISOString()).in("status", activeStatuses),
    client.from("bookings").select("id", { count: "exact", head: true }).or("status.eq.pending,provider_sync_state.in.(pending,failed)"),
    client.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
    client.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
  ]) : null;

  const allBookings = ((results?.[0].data || []) as unknown as AdminBookingListRow[]).sort((left, right) => {
    const leftUpcoming = activeStatuses.includes(left.status) && Date.parse(left.appointment_start) >= now.getTime();
    const rightUpcoming = activeStatuses.includes(right.status) && Date.parse(right.appointment_start) >= now.getTime();
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    return leftUpcoming
      ? left.appointment_start.localeCompare(right.appointment_start)
      : right.appointment_start.localeCompare(left.appointment_start);
  });
  const filteredBookings = allBookings.filter((booking) => {
    const customer = relation(booking.customers);
    const vehicle = relation(booking.vehicles);
    const searchable = [booking.booking_reference, booking.service_name, customer?.name, customer?.email, vehicle?.registration, vehicle?.make, vehicle?.model, booking.location].filter(Boolean).join(" ").toLowerCase();
    return (!query || searchable.includes(query.toLowerCase())) && (!status || booking.status === status);
  });
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const bookings = filteredBookings.slice((page - 1) * pageSize, page * pageSize);

  const metrics = [
    { label: "Today", value: results?.[1].count || 0, icon: CalendarCheck2, tone: "blue" },
    { label: "Upcoming", value: results?.[2].count || 0, icon: CalendarClock, tone: "navy" },
    { label: "Awaiting action", value: results?.[3].count || 0, icon: AlertTriangle, tone: "amber" },
    { label: "Completed", value: results?.[4].count || 0, icon: CheckCircle2, tone: "green" },
    { label: "Cancelled", value: results?.[5].count || 0, icon: CircleX, tone: "red" },
  ] as const;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]">
            <CalendarClock size={23} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Garage appointments</p>
            <h1 className="mt-1 text-4xl font-extrabold text-[#071127]">Bookings</h1>
            <p className="mt-2 max-w-2xl text-[#667586]">Review appointment details, calendar sync and bookings that need attention.</p>
          </div>
        </div>
        <Link href="/admin/bookings/services" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C9D5E2] bg-white px-4 text-sm font-extrabold text-[#1446A5] transition hover:border-[#1974E2] hover:bg-[#F1F7FF]">
          <Settings2 size={17} aria-hidden="true" /> Service mappings
        </Link>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Booking summary">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="rounded-2xl border border-[#E4EAF0] bg-white p-4 sm:p-5">
              <span className={cn(
                "grid size-9 place-items-center rounded-xl",
                metric.tone === "blue" && "bg-[#EAF3FF] text-[#1974E2]",
                metric.tone === "navy" && "bg-[#EEF1F7] text-[#1446A5]",
                metric.tone === "amber" && "bg-amber-100 text-amber-800",
                metric.tone === "green" && "bg-green-100 text-green-800",
                metric.tone === "red" && "bg-red-100 text-red-800",
              )}><Icon size={18} aria-hidden="true" /></span>
              <p className="mt-4 text-3xl font-extrabold text-[#071127]">{metric.value}</p>
              <p className="mt-1 text-xs font-bold text-[#667586] sm:text-sm">{metric.label}</p>
            </article>
          );
        })}
      </section>

      <AdminListFilters action="/admin/bookings" query={query} status={status} placeholder="Reference, customer, vehicle or service…" statusOptions={[{ value: "pending", label: "Pending" }, { value: "confirmed", label: "Confirmed" }, { value: "rescheduled", label: "Rescheduled" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} />

      <section className="mt-8" aria-labelledby="booking-list-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="booking-list-heading" className="text-2xl font-extrabold text-[#071127]">Appointment list</h2>
            <p className="mt-1 text-sm text-[#667586]">Upcoming appointments appear first, followed by the most recent records.</p>
          </div>
          <p className="text-sm font-bold text-[#667586]">{filteredBookings.length} matching</p>
        </div>

        <div className="mt-5 hidden max-h-[60vh] overflow-auto rounded-2xl border border-[#E4EAF0] bg-white xl:block">
          <table className="w-full min-w-[1120px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-[#F4F7FA] text-xs font-extrabold tracking-wide text-[#586575] uppercase shadow-[0_1px_0_#E4EAF0]">
              <tr>
                <th className="w-[12%] px-4 py-4">Time</th>
                <th className="w-[12%] px-4 py-4">Booking ref</th>
                <th className="w-[15%] px-4 py-4">Customer</th>
                <th className="w-[15%] px-4 py-4">Vehicle</th>
                <th className="w-[15%] px-4 py-4">Service</th>
                <th className="w-[10%] px-4 py-4">Status</th>
                <th className="w-[12%] px-4 py-4">Location</th>
                <th className="w-[9%] px-4 py-4">Calendar sync</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const customer = relation(booking.customers);
                const vehicle = relation(booking.vehicles);
                return (
                  <tr key={booking.id} className={cn("border-t border-[#E4EAF0] align-top transition hover:bg-[#F8FAFC]", booking.provider_sync_state === "failed" && "bg-amber-50/60")}>
                    <td className="px-4 py-4 text-sm font-bold text-[#071127]">{formatCompactDate(booking.appointment_start)}</td>
                    <td className="px-4 py-4"><Link href={`/admin/bookings/${booking.id}`} className="font-mono text-sm font-black text-[#1974E2] hover:underline">{booking.booking_reference}</Link></td>
                    <td className="px-4 py-4"><p className="truncate text-sm font-extrabold text-[#071127]">{customer?.name || "Customer"}</p><p className="mt-1 truncate text-xs text-[#667586]">{customer?.email || "No email"}</p></td>
                    <td className="px-4 py-4 text-sm text-[#586575]">{vehicleLabel(vehicle)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-[#071127]">{booking.service_name}</td>
                    <td className="px-4 py-4"><BookingStatusBadge status={booking.status} /></td>
                    <td className="px-4 py-4"><p className="text-sm font-bold text-[#071127]">{locationModeLabel(booking.location_mode)}</p>{booking.location && <p className="mt-1 line-clamp-2 text-xs text-[#667586]">{booking.location}</p>}</td>
                    <td className="px-4 py-4"><SyncStateBadge state={booking.provider_sync_state} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid max-h-[65vh] gap-4 overflow-y-auto pr-1 xl:hidden">
          {bookings.map((booking) => {
            const customer = relation(booking.customers);
            const vehicle = relation(booking.vehicles);
            return (
              <article key={booking.id} className={cn("rounded-2xl border bg-white p-5", booking.provider_sync_state === "failed" ? "border-amber-300" : "border-[#E4EAF0]")}>
                <Link href={`/admin/bookings/${booking.id}`} className="block rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/20" aria-label={`Open booking ${booking.booking_reference}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-black tracking-wide text-[#1974E2]">{booking.booking_reference}</p>
                      <h3 className="mt-2 truncate text-xl font-extrabold text-[#071127]">{customer?.name || "Customer"}</h3>
                      <p className="mt-1 text-sm font-semibold text-[#586575]">{formatFullDate(booking.appointment_start)}</p>
                    </div>
                    <ChevronRight className="mt-1 shrink-0 text-[#1974E2]" size={21} aria-hidden="true" />
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
                    <ListDetail label="Vehicle" value={vehicleLabel(vehicle)} />
                    <ListDetail label="Service" value={booking.service_name} />
                    <ListDetail label="Location" value={booking.location || locationModeLabel(booking.location_mode)} />
                    <div><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">Status</dt><dd className="mt-2"><BookingStatusBadge status={booking.status} /></dd></div>
                  </dl>
                  <div className="mt-5 border-t border-[#E4EAF0] pt-4"><SyncStateBadge state={booking.provider_sync_state} /></div>
                </Link>
              </article>
            );
          })}
        </div>

        {!bookings.length && (
          <div className="mt-5 rounded-2xl border border-[#E4EAF0] bg-white p-10 text-center">
            <CalendarClock className="mx-auto text-[#1974E2]" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-[#071127]">No booking records yet</h2>
            <p className="mt-2 text-sm text-[#667586]">Appointments will appear here after a customer completes the SOB Autofix booking flow.</p>
          </div>
        )}
        <AdminPagination path="/admin/bookings" page={page} pageSize={pageSize} totalItems={filteredBookings.length} query={query} status={status} />
      </section>
    </>
  );
}

function ListDetail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{label}</dt><dd className="mt-1 line-clamp-2 font-bold text-[#071127]">{value}</dd></div>;
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
  const details: Record<ProviderSyncState, { label: string; className: string }> = {
    synced: { label: "Synced", className: "bg-green-100 text-green-800" },
    pending: { label: "Pending sync", className: "bg-amber-100 text-amber-900" },
    failed: { label: "Sync failed", className: "bg-red-100 text-red-800" },
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", details[state].className)}>{details[state].label}</span>;
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

function vehicleLabel(vehicle: { registration: string | null; make: string | null; model: string | null } | null) {
  return [vehicle?.make, vehicle?.model, vehicle?.registration ? formatRegistration(vehicle.registration) : null].filter(Boolean).join(" · ") || "Vehicle not recorded";
}

function locationModeLabel(value: AdminBookingListRow["location_mode"]) {
  if (value === "mobile") return "Mobile";
  if (value === "workshop") return "Workshop";
  return "Location recorded";
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

function dateKeyInLondon(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/London" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function londonMidnight(dateKey: string) {
  const [year = 0, month = 0, day = 0] = dateKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    }).formatToParts(new Date(guess));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value || 0);
    const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour") % 24, part("minute"), part("second"));
    guess += target - represented;
  }
  return new Date(guess).toISOString();
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function positivePage(value?: string) { const parsed = Number.parseInt(value || "1", 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : 1; }
