import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CarFront,
  CheckCircle2,
  CircleAlert,
  FileText,
  Inbox,
  Plus,
  Radio,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import {
  auditActionLabel,
  auditEntityLabel,
  countStatuses,
  createSystemHealthChecks,
  formatRelativeTime,
  type HealthState,
} from "@/lib/admin/dashboard";
import { createClient, getAdminUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type RecentEnquiry = {
  id: string;
  type: string;
  service_slug: string | null;
  status: "new" | "contacted" | "booked" | "closed";
  created_at: string;
  customers: { name: string } | null;
  vehicles: { registration: string | null; make: string | null; model: string | null } | null;
};

type AuditEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: unknown;
  created_at: string;
};

type BookingSummary = {
  id: string;
  status: string;
  appointment_start: string;
  provider_sync_state: string;
};

const emptyResult = { data: [], count: 0, error: null };

export default async function DashboardPage() {
  const client = await createClient();
  const admin = await getAdminUser();
  const now = new Date();

  const [newEnquiriesResult, recentEnquiriesResult, stockResult, contentResult, failedEmailsResult, activityResult, bookingsResult, bookingServicesResult] = client
    ? await Promise.all([
        client.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
        client.from("enquiries").select("id,type,service_slug,status,created_at,customers(name),vehicles(registration,make,model)").order("created_at", { ascending: false }).limit(5),
        client.from("sale_vehicles").select("id,status"),
        client.from("content_entries").select("id,status,kind"),
        client.from("enquiries").select("id", { count: "exact", head: true }).eq("notification_status", "failed"),
        client.from("admin_audit_log").select("id,actor_id,action,entity_type,entity_id,detail,created_at").order("created_at", { ascending: false }).limit(6),
        client.from("bookings").select("id,status,appointment_start,provider_sync_state").order("appointment_start", { ascending: true }).limit(500),
        client.from("booking_service_types").select("id", { count: "exact", head: true }).eq("online_booking_enabled", true).not("provider_event_type_id", "is", null),
      ])
    : [emptyResult, emptyResult, emptyResult, emptyResult, emptyResult, emptyResult, emptyResult, emptyResult];

  const recentEnquiries = (recentEnquiriesResult.data || []) as unknown as RecentEnquiry[];
  const stockRows = (stockResult.data || []) as Array<{ status: string }>;
  const contentRows = (contentResult.data || []) as Array<{ status: string; kind: string }>;
  const activity = (activityResult.data || []) as unknown as AuditEntry[];
  const bookingRows = (bookingsResult.data || []) as BookingSummary[];
  const stockCounts = countStatuses(stockRows, ["available", "reserved", "sold"]);
  const articleCounts = countStatuses(contentRows.filter((entry) => entry.kind === "article"), ["published", "draft", "scheduled"]);
  const databaseReady = Boolean(client) && ![
    newEnquiriesResult,
    recentEnquiriesResult,
    stockResult,
    contentResult,
    failedEmailsResult,
    activityResult,
    bookingsResult,
    bookingServicesResult,
  ].some((result) => result.error);

  const todayKey = londonDateKey(now);
  const todayAppointments = bookingRows.filter((booking) => londonDateKey(new Date(booking.appointment_start)) === todayKey && !["cancelled", "completed"].includes(booking.status)).length;
  const upcomingBookings = bookingRows.filter((booking) => new Date(booking.appointment_start) > now && !["cancelled", "completed"].includes(booking.status)).length;
  const bookingAttention = bookingRows.filter((booking) => booking.provider_sync_state === "failed").length;
  const bookingConfigured = Boolean(process.env.CALCOM_API_KEY && process.env.CALCOM_WEBHOOK_SECRET && process.env.BOOKING_MANAGEMENT_SECRET && (bookingServicesResult.count || 0) > 0);

  const systemHealth = createSystemHealthChecks({
    websiteReady: isWebsiteReady(),
    databaseReady,
    emailReady: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_REPLY_TO", "ENQUIRY_NOTIFICATION_EMAIL"].every((key) => Boolean(process.env[key])),
    bookingReady: bookingConfigured,
    vehicleLookupReady: (process.env.VEHICLE_LOOKUP_PROVIDER === "vehicle-data-global"
      && ["VEHICLE_DATA_GLOBAL_API_KEY", "VEHICLE_DATA_GLOBAL_BASE_URL", "VEHICLE_DATA_GLOBAL_PACKAGE"].every((key) => Boolean(process.env[key])))
      || Boolean(process.env.DVLA_API_KEY)
      || (process.env.PLAYWRIGHT_TEST === "true" && process.env.VEHICLE_LOOKUP_PROVIDER === "mock"),
  });

  const failedEmails = failedEmailsResult.count ?? 0;
  const setupIssues = systemHealth.filter((check) => check.state !== "healthy").length;
  const attentionRequired = failedEmails + bookingAttention + setupIssues;
  const vehiclesForSale = (stockCounts.available ?? 0) + (stockCounts.reserved ?? 0);
  const displayName = admin?.profile.display_name || "Administrator";
  const greeting = greetingForDate(now);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-extrabold tracking-[0.16em] text-[#1974E2] uppercase">Operations overview</p>
          <h1 className="mt-2 text-4xl font-extrabold text-[#071127] sm:text-5xl">{greeting}, {firstName(displayName)}.</h1>
          <p className="mt-2 text-sm font-semibold text-[#7A8796]">{formatDashboardDate(now)}</p>
        </div>
        <div className="hidden flex-wrap gap-2 md:flex" aria-label="Quick actions">
          <QuickAction href="/admin/enquiries" label="View enquiries" icon={Inbox} variant="secondary" />
          <QuickAction href="/admin/inventory/new" label="Add vehicle" icon={CarFront} variant="secondary" />
          <QuickAction href="/admin/news/new" label="Add article" icon={Plus} />
        </div>
      </div>

      {!databaseReady && (
        <div role="alert" className="mt-7 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
          Some dashboard data could not be loaded. Review System Health and refresh after the connection is restored.
        </div>
      )}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key performance indicators">
        <KpiCard
          label="New enquiries"
          value={newEnquiriesResult.count ?? 0}
          support="Awaiting first review"
          href="/admin/enquiries"
          icon={Inbox}
        />
        <KpiCard
          label="Published articles"
          value={articleCounts.published ?? 0}
          support="Live news and advice"
          href="/admin/news"
          icon={FileText}
        />
        <KpiCard
          label="Vehicles for sale"
          value={vehiclesForSale}
          support="Available or reserved"
          href="/admin/inventory"
          icon={CarFront}
        />
        <KpiCard
          label="Attention required"
          value={attentionRequired}
          support={`${failedEmails} email ${failedEmails === 1 ? "failure" : "failures"} · ${setupIssues} setup ${setupIssues === 1 ? "item" : "items"}`}
          href="#system-health"
          icon={CircleAlert}
          tone={attentionRequired > 0 ? "warning" : "default"}
        />
      </section>

      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-12">
        <RecentEnquiriesPanel enquiries={recentEnquiries} now={now} />

        <div className="grid content-start gap-6 xl:col-span-4">
          <BookingPanel configured={bookingConfigured} today={todayAppointments} upcoming={upcomingBookings} attention={bookingAttention} />
          <SystemHealthPanel checks={systemHealth} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-12">
        <StockPanel counts={stockCounts} />
        <ContentPanel counts={articleCounts} />
        <ActivityPanel entries={activity} displayName={displayName} now={now} />
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  support,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  support: string;
  href: string;
  icon: LucideIcon;
  tone?: "default" | "warning";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-xl border bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#1974E2]/45 hover:shadow-[0_10px_24px_rgba(7,17,39,0.08)]",
        tone === "warning" ? "border-amber-200" : "border-[#E4EAF0]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid size-8 place-items-center rounded-lg", tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-[#EAF3FF] text-[#1974E2]") }>
          <Icon size={17} aria-hidden="true" />
        </span>
        <ArrowRight size={17} className="text-[#A4AFBB] transition group-hover:translate-x-1 group-hover:text-[#1974E2]" aria-hidden="true" />
      </div>
      <strong className="mt-3 block text-3xl leading-none text-[#071127]">{value}</strong>
      <h2 className="mt-1.5 text-sm font-bold text-[#071127]">{label}</h2>
      <p className="mt-0.5 text-[0.7rem] leading-4 text-[#667586]">{support}</p>
    </Link>
  );
}

function RecentEnquiriesPanel({ enquiries, now }: { enquiries: RecentEnquiry[]; now: Date }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white xl:col-span-8" aria-labelledby="recent-enquiries-heading">
      <PanelHeader
        id="recent-enquiries-heading"
        title="Recent enquiries"
        description="The latest customer requests received from the website."
        href="/admin/enquiries"
        action="View all"
      />
      {enquiries.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-y border-[#E4EAF0] bg-[#F8FAFC] text-[0.68rem] tracking-wide text-[#667586] uppercase">
                <tr>
                  <th className="px-5 py-3 font-extrabold">Customer</th>
                  <th className="px-4 py-3 font-extrabold">Vehicle</th>
                  <th className="px-4 py-3 font-extrabold">Request</th>
                  <th className="px-4 py-3 font-extrabold">Status</th>
                  <th className="px-4 py-3 font-extrabold">Received</th>
                  <th className="px-5 py-3 text-right font-extrabold"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EAF0]">
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-4 font-bold text-[#071127]">{enquiry.customers?.name || "Customer"}</td>
                    <td className="px-4 py-4 text-[#586575]">{vehicleLabel(enquiry.vehicles)}</td>
                    <td className="px-4 py-4 text-[#586575]">{requestLabel(enquiry)}</td>
                    <td className="px-4 py-4"><EnquiryStatus status={enquiry.status} /></td>
                    <td className="whitespace-nowrap px-4 py-4 text-[#667586]">{formatRelativeTime(enquiry.created_at, now)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link className="font-bold text-[#1974E2] hover:text-[#1446A5]" href={`/admin/enquiries/${enquiry.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[#E4EAF0] md:hidden">
            {enquiries.map((enquiry) => (
              <article key={enquiry.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#071127]">{enquiry.customers?.name || "Customer"}</h3>
                    <p className="mt-1 text-sm text-[#586575]">{vehicleLabel(enquiry.vehicles)}</p>
                  </div>
                  <EnquiryStatus status={enquiry.status} />
                </div>
                <p className="mt-3 text-sm font-semibold text-[#071127]">{requestLabel(enquiry)}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#667586]">
                  <span>{formatRelativeTime(enquiry.created_at, now)}</span>
                  <Link className="font-bold text-[#1974E2]" href={`/admin/enquiries/${enquiry.id}`}>Open enquiry</Link>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No enquiries yet"
          body="New website enquiries will appear here automatically."
          href="/admin/enquiries"
          action="Open enquiries"
        />
      )}
    </section>
  );
}

function BookingPanel({ configured, today, upcoming, attention }: { configured: boolean; today: number; upcoming: number; attention: number }) {
  return (
    <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5" aria-labelledby="appointments-heading">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]">
          <CalendarClock size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id="appointments-heading" className="text-lg font-bold text-[#071127]">Upcoming appointments</h2>
          <p className="mt-1 text-sm leading-6 text-[#667586]">Local booking records keep this overview fast and independent of a live provider request.</p>
        </div>
      </div>
      <div className={cn("mt-5 rounded-xl border p-4 text-sm", configured ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900")}>
        <strong className="block">{configured ? "Online booking is configured" : "Online booking needs configuration"}</strong>
        <span className="mt-1 block text-xs leading-5">{configured ? "Availability, management security and service mappings are present." : "Add the calendar credentials, webhook secret and at least one verified service mapping."}</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniMetric label="Today" value={today} />
        <MiniMetric label="Upcoming" value={upcoming} />
        <MiniMetric label="Attention" value={attention} />
      </dl>
      <Link href="/admin/bookings" className="mt-4 inline-flex min-h-10 items-center gap-2 font-bold text-[#1974E2] hover:text-[#1446A5]">
        Manage bookings <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}

function SystemHealthPanel({ checks }: { checks: ReturnType<typeof createSystemHealthChecks> }) {
  return (
    <section id="system-health" className="scroll-mt-24 rounded-2xl border border-[#E4EAF0] bg-white p-5" aria-labelledby="system-health-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-extrabold tracking-[0.14em] text-[#1974E2] uppercase">Configuration</p>
          <h2 id="system-health-heading" className="mt-1 text-lg font-bold text-[#071127]">System health</h2>
        </div>
        <Radio size={20} className="text-[#1974E2]" aria-hidden="true" />
      </div>
      <div className="mt-4 divide-y divide-[#E4EAF0]">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#071127]">{check.label}</p>
              <p className="truncate text-xs text-[#667586]">{check.detail}</p>
            </div>
            <HealthBadge state={check.state} label={check.status} />
          </div>
        ))}
      </div>
      <Link href="/admin/settings" className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#1974E2] hover:text-[#1446A5]">
        Review settings <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}

function StockPanel({ counts }: { counts: Record<string, number> }) {
  return (
    <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 md:col-span-1 xl:col-span-4" aria-labelledby="stock-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-extrabold tracking-[0.14em] text-[#1974E2] uppercase">Sales</p>
          <h2 id="stock-heading" className="mt-1 text-xl font-bold text-[#071127]">Vehicle stock</h2>
        </div>
        <CarFront className="text-[#1974E2]" size={23} aria-hidden="true" />
      </div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-[#E4EAF0] rounded-xl bg-[#F8FAFC] py-4 text-center">
        <MiniMetric label="Available" value={counts.available ?? 0} />
        <MiniMetric label="Reserved" value={counts.reserved ?? 0} />
        <MiniMetric label="Sold" value={counts.sold ?? 0} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/admin/inventory/new" className="text-[#1974E2] hover:text-[#1446A5]">Add vehicle</Link>
        <Link href="/admin/inventory" className="text-[#586575] hover:text-[#071127]">Manage stock</Link>
      </div>
    </section>
  );
}

function ContentPanel({ counts }: { counts: Record<string, number> }) {
  return (
    <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 md:col-span-1 xl:col-span-4" aria-labelledby="content-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-extrabold tracking-[0.14em] text-[#1974E2] uppercase">Publishing</p>
          <h2 id="content-heading" className="mt-1 text-xl font-bold text-[#071127]">News &amp; Blog</h2>
        </div>
        <FileText className="text-[#1974E2]" size={23} aria-hidden="true" />
      </div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-[#E4EAF0] rounded-xl bg-[#F8FAFC] py-4 text-center">
        <MiniMetric label="Published" value={counts.published ?? 0} />
        <MiniMetric label="Draft" value={counts.draft ?? 0} />
        <MiniMetric label="Scheduled" value={counts.scheduled ?? 0} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/admin/news/new" className="text-[#1974E2] hover:text-[#1446A5]">Create article</Link>
        <Link href="/admin/news" className="text-[#586575] hover:text-[#071127]">Manage articles</Link>
      </div>
    </section>
  );
}

function ActivityPanel({ entries, displayName, now }: { entries: AuditEntry[]; displayName: string; now: Date }) {
  return (
    <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 md:col-span-2 xl:col-span-4" aria-labelledby="activity-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-extrabold tracking-[0.14em] text-[#1974E2] uppercase">Audit log</p>
          <h2 id="activity-heading" className="mt-1 text-xl font-bold text-[#071127]">Recent activity</h2>
        </div>
        <Wrench className="text-[#1974E2]" size={22} aria-hidden="true" />
      </div>
      {entries.length > 0 ? (
        <ol className="mt-4 divide-y divide-[#E4EAF0]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1974E2]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-[#071127]"><strong className="capitalize">{auditActionLabel(entry.action, entry.entity_type)}</strong> <span className="capitalize text-[#586575]">{auditEntityLabel(entry.entity_type, entry.detail)}</span></p>
                <p className="mt-1 text-xs text-[#7A8796]">{entry.actor_id ? displayName : "System"} · {formatRelativeTime(entry.created_at, now)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-5 rounded-xl bg-[#F8FAFC] p-5 text-center">
          <CheckCircle2 className="mx-auto text-[#1974E2]" size={24} aria-hidden="true" />
          <p className="mt-3 font-bold text-[#071127]">No activity recorded yet</p>
          <p className="mt-1 text-sm text-[#667586]">Publishing and operational changes will appear here.</p>
        </div>
      )}
    </section>
  );
}

function PanelHeader({ id, title, description, href, action }: { id: string; title: string; description: string; href: string; action: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div>
        <h2 id={id} className="text-xl font-bold text-[#071127]">{title}</h2>
        <p className="mt-1 text-sm text-[#667586]">{description}</p>
      </div>
      <Link href={href} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#1974E2] hover:text-[#1446A5]">
        {action} <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, href, action }: { icon: LucideIcon; title: string; body: string; href: string; action: string }) {
  return (
    <div className="border-t border-[#E4EAF0] px-5 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]">
        <Icon size={23} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-[#071127]">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#667586]">{body}</p>
      <Link href={href} className="mt-4 inline-flex min-h-10 items-center gap-2 font-bold text-[#1974E2]">
        {action} <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div className="px-2"><strong className="block text-2xl text-[#071127]">{value}</strong><span className="mt-1 block text-[0.68rem] font-bold text-[#667586]">{label}</span></div>;
}

function EnquiryStatus({ status }: { status: RecentEnquiry["status"] }) {
  const styles = {
    new: "bg-[#EAF3FF] text-[#1446A5]",
    contacted: "bg-amber-100 text-amber-900",
    booked: "bg-green-100 text-green-800",
    closed: "bg-[#E4EAF0] text-[#586575]",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold capitalize", styles[status])}>{status}</span>;
}

function HealthBadge({ state, label }: { state: HealthState; label: string }) {
  const styles = state === "healthy" ? "bg-green-100 text-green-800" : state === "degraded" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900";
  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold", styles)}>{label}</span>;
}

function QuickAction({ href, label, icon: Icon, variant = "primary" }: { href: string; label: string; icon: LucideIcon; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition",
        variant === "primary" ? "bg-[#1974E2] text-white hover:bg-[#168BFF]" : "border border-[#D7E0E9] bg-white text-[#071127] hover:border-[#1974E2] hover:text-[#1974E2]",
      )}
    >
      <Icon size={17} aria-hidden="true" /> {label}
    </Link>
  );
}

function requestLabel(enquiry: RecentEnquiry) {
  return (enquiry.service_slug || enquiry.type).replaceAll("_", " ").replaceAll("-", " ");
}

function vehicleLabel(vehicle: RecentEnquiry["vehicles"]) {
  if (!vehicle) return "Not supplied";
  return [vehicle.make, vehicle.model, vehicle.registration].filter(Boolean).join(" · ") || "Not supplied";
}

function greetingForDate(date: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/London" }).format(date));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDashboardDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(date);
}

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "Administrator";
}

function londonDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/London" }).format(date);
}

function isWebsiteReady() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  try {
    const url = new URL(value);
    if (process.env.NODE_ENV !== "production") return true;
    return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}
