import { AlertTriangle, Bell, CalendarClock, MailWarning } from "lucide-react";
import Link from "next/link";
import { AdminPagination } from "@/components/admin/admin-list-controls";
import { ADMIN_LIST_PAGE_SIZE, positiveAdminPage } from "@/lib/admin/pagination";
import { createAdminReadClient } from "@/lib/supabase/server";

type AlertRow = {
  id: string;
  type: string;
  status: string;
  notification_status: string;
  created_at: string;
  customers: { name: string; email: string | null; phone: string } | null;
};

type BookingAlertRow = {
  id: string;
  booking_reference: string;
  status: string;
  provider_sync_state: string;
  admin_seen_at: string | null;
  service_name: string;
  created_at: string;
  customers: { name: string; email: string | null; phone: string | null } | null;
};

type DisplayAlert = {
  key: string;
  kind: "booking" | "enquiry";
  title: string;
  subtitle: string;
  customer: string;
  reason: string;
  createdAt: string;
  href: string;
  badges: Array<{ label: string; tone?: "danger" | "pending" }>;
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = positiveAdminPage((await searchParams).page);
  const client = await createAdminReadClient();
  const [alertsResult, unreadResult, unmatchedResult, repliedResult, bookingResult, bookingDeliveryResult] = client
    ? await Promise.all([
        client.from("enquiries").select("id,type,status,notification_status,created_at,customers(name,email,phone)").is("deleted_at", null).or("status.eq.new,notification_status.in.(pending,failed)").order("created_at", { ascending: false }).limit(100),
        client.from("enquiry_conversations").select("enquiry_id,unread_count,enquiries!inner(deleted_at)").is("enquiries.deleted_at", null).gt("unread_count", 0),
        client.from("unmatched_inbound_emails").select("id", { count: "exact", head: true }).is("linked_enquiry_id", null).is("ignored_at", null).neq("reason", "automated_ignored"),
        client.from("enquiry_messages").select("enquiry_id").eq("direction", "outbound").eq("message_type", "email").in("delivery_status", ["sent", "delivered"]),
        client.from("bookings").select("id,booking_reference,status,provider_sync_state,admin_seen_at,service_name,created_at,customers(name,email,phone)").is("deleted_at", null).or("admin_seen_at.is.null,provider_sync_state.in.(pending,failed)").order("created_at", { ascending: false }).limit(100),
        client.from("booking_notification_events").select("booking_id,status,bookings!inner(deleted_at)").is("bookings.deleted_at", null).in("status", ["pending", "failed"]),
      ])
    : [{ data: [], error: new Error("Database unavailable") }, { data: [] }, { count: 0 }, { data: [] }, { data: [], error: new Error("Database unavailable") }, { data: [], error: new Error("Database unavailable") }];

  let alerts = (alertsResult.data || []) as unknown as AlertRow[];
  const repliedIds = new Set((repliedResult.data || []).map((item) => item.enquiry_id));
  alerts = alerts.filter((item) => item.status !== "new" || !repliedIds.has(item.id) || ["pending", "failed"].includes(item.notification_status));
  const unreadIds = new Set((unreadResult.data || []).map((item) => item.enquiry_id));
  const missingUnreadIds = [...unreadIds].filter((id) => !alerts.some((alert) => alert.id === id));
  if (client && missingUnreadIds.length) {
    const { data: unreadEnquiries } = await client.from("enquiries").select("id,type,status,notification_status,created_at,customers(name,email,phone)").in("id", missingUnreadIds).is("deleted_at", null);
    alerts = [...alerts, ...((unreadEnquiries || []) as unknown as AlertRow[])];
  }
  const bookingDeliveryStates = new Map<string, Set<string>>();
  for (const item of bookingDeliveryResult.data || []) {
    const states = bookingDeliveryStates.get(item.booking_id) || new Set<string>();
    states.add(item.status);
    bookingDeliveryStates.set(item.booking_id, states);
  }
  let bookingAlerts = (bookingResult.data || []) as unknown as BookingAlertRow[];
  const missingBookingIds = [...bookingDeliveryStates.keys()].filter((id) => !bookingAlerts.some((booking) => booking.id === id));
  if (client && missingBookingIds.length) {
    const { data: deliveryBookings } = await client.from("bookings").select("id,booking_reference,status,provider_sync_state,admin_seen_at,service_name,created_at,customers(name,email,phone)").in("id", missingBookingIds).is("deleted_at", null);
    bookingAlerts = [...bookingAlerts, ...((deliveryBookings || []) as unknown as BookingAlertRow[])];
  }

  const enquiryDisplayAlerts: DisplayAlert[] = alerts.map((alert) => ({
    key: `enquiry:${alert.id}`,
    kind: "enquiry",
    title: formatType(alert.type),
    subtitle: "Enquiry",
    customer: alert.customers?.name || "Customer enquiry",
    reason: alert.status === "new" ? "New enquiry awaiting review" : unreadIds.has(alert.id) ? "New customer reply" : "Enquiry in progress",
    createdAt: alert.created_at,
    href: `/admin/enquiries/${alert.id}`,
    badges: [
      ...(alert.status === "new" ? [{ label: "New" }] : []),
      ...(unreadIds.has(alert.id) ? [{ label: "Unread reply" }] : []),
      ...(alert.notification_status === "failed" ? [{ label: "Email failed", tone: "danger" as const }] : []),
      ...(alert.notification_status === "pending" ? [{ label: "Email pending", tone: "pending" as const }] : []),
    ],
  }));
  const bookingDisplayAlerts: DisplayAlert[] = bookingAlerts.map((booking) => {
    const deliveryStates = bookingDeliveryStates.get(booking.id) || new Set<string>();
    const reasons = [
      !booking.admin_seen_at ? "New booking awaiting review" : null,
      booking.provider_sync_state === "failed" ? "Calendar sync failed" : booking.provider_sync_state === "pending" ? "Calendar sync pending" : null,
      deliveryStates.has("failed") ? "Booking email delivery failed" : deliveryStates.has("pending") ? "Booking email delivery pending" : null,
    ].filter(Boolean);
    return {
      key: `booking:${booking.id}`,
      kind: "booking" as const,
      title: booking.booking_reference,
      subtitle: booking.service_name,
      customer: booking.customers?.name || "Customer booking",
      reason: reasons.join(" · ") || "Booking needs review",
      createdAt: booking.created_at,
      href: `/admin/bookings/${booking.id}`,
      badges: [
        ...(!booking.admin_seen_at ? [{ label: "New" }] : []),
        ...(booking.provider_sync_state === "failed" ? [{ label: "Sync failed", tone: "danger" as const }] : []),
        ...(booking.provider_sync_state === "pending" ? [{ label: "Sync pending", tone: "pending" as const }] : []),
        ...(deliveryStates.has("failed") ? [{ label: "Email failed", tone: "danger" as const }] : []),
        ...(deliveryStates.has("pending") ? [{ label: "Email pending", tone: "pending" as const }] : []),
      ],
    };
  });
  const displayAlerts = [...enquiryDisplayAlerts, ...bookingDisplayAlerts].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const failedBookingEmails = new Set((bookingDeliveryResult.data || []).filter((item) => item.status === "failed").map((item) => item.booking_id)).size;
  const failedEmails = alerts.filter((item) => item.notification_status === "failed").length + failedBookingEmails;
  const newBookings = bookingAlerts.filter((booking) => !booking.admin_seen_at).length;
  const attentionCount = displayAlerts.length + (unmatchedResult.count || 0);
  const loadFailed = Boolean(alertsResult.error || bookingResult.error || bookingDeliveryResult.error);
  const totalPages = Math.max(1, Math.ceil(displayAlerts.length / ADMIN_LIST_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visibleAlerts = displayAlerts.slice((page - 1) * ADMIN_LIST_PAGE_SIZE, page * ADMIN_LIST_PAGE_SIZE);

  return (
    <>
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Operations</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#071127]">Notification centre</h1>
          <p className="mt-2 max-w-2xl text-[#586575]">New bookings, customer requests, unread replies and operational issues that need attention.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/admin/bookings" className="rounded-xl bg-[#071127] px-4 py-3 text-sm font-bold text-white">View bookings</Link><Link href="/admin/enquiries" className="rounded-xl border border-[#D7E0E9] bg-white px-4 py-3 text-sm font-bold text-[#071127]">View enquiries</Link></div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard href="#attention-heading" icon={<Bell />} label="Requires attention" value={attentionCount} />
        <SummaryCard href="/admin/bookings" icon={<CalendarClock />} label="New bookings" value={newBookings} />
        <SummaryCard href="#attention-heading" icon={<MailWarning />} label="Email failures" value={failedEmails} tone={failedEmails ? "danger" : "default"} />
        <SummaryCard href="/admin/enquiries/unmatched" icon={<MailWarning />} label="Unmatched inbound" value={unmatchedResult.count || 0} />
      </div>

      {(unmatchedResult.count || 0) > 0 && <Link href="/admin/enquiries/unmatched" className="mt-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-950"><span>{unmatchedResult.count} unmatched inbound {unmatchedResult.count === 1 ? "email needs" : "emails need"} review</span><span aria-hidden="true">→</span></Link>}

      {loadFailed && <div role="alert" className="mt-8 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><AlertTriangle className="shrink-0" size={20} />Notifications could not be loaded. Refresh the page or check the database connection.</div>}

      <section className="mt-10" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-2xl font-bold text-[#071127]">Needs attention</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#E4EAF0] bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#F4F7FA] text-xs font-bold uppercase tracking-wide text-[#667586]">
              <tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr>
            </thead>
            <tbody>
          {visibleAlerts.map((alert) => (
            <tr key={alert.key} className="border-t border-[#E4EAF0] hover:bg-[#FAFCFE]">
              <td className="px-5 py-4"><p className="font-bold capitalize text-[#071127]">{alert.title}</p><p className="mt-1 text-xs text-[#667586]">{alert.subtitle} · {formatDate(alert.createdAt)}</p></td>
              <td className="px-5 py-4 font-bold text-[#071127]">{alert.customer}</td>
              <td className="px-5 py-4 text-[#586575]">{alert.reason}</td>
              <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{alert.badges.map((badge) => <StatusBadge key={`${badge.label}:${badge.tone || "default"}`} label={badge.label} danger={badge.tone === "danger"} pending={badge.tone === "pending"} />)}</div></td>
              <td className="px-5 py-4 text-right"><Link href={alert.href} className="inline-flex min-h-10 items-center whitespace-nowrap font-bold text-[#1974E2] hover:underline">Open {alert.kind}</Link></td>
            </tr>
          ))}
            </tbody>
          </table>
          {!loadFailed && displayAlerts.length === 0 && <p className="p-8 text-center text-[#667586]">Nothing needs attention.</p>}
        </div>
        <AdminPagination path="/admin/notifications" page={page} pageSize={ADMIN_LIST_PAGE_SIZE} totalItems={displayAlerts.length} query="" status="" />
      </section>

    </>
  );
}

function SummaryCard({ href, icon, label, value, tone = "default" }: { href: string; icon: React.ReactNode; label: string; value: number; tone?: "default" | "danger" }) {
  return <Link href={href} className={`group rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#1974E2] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1974E2] ${tone === "danger" ? "border-red-200" : "border-[#E4EAF0]"}`}><span className={tone === "danger" ? "text-red-700" : "text-[#1974E2]"}>{icon}</span><p className="mt-4 text-sm font-semibold text-[#667586] group-hover:text-[#1974E2]">{label}</p><strong className="mt-1 block text-3xl text-[#071127]">{value}</strong></Link>;
}

function StatusBadge({ label, danger = false, pending = false }: { label: string; danger?: boolean; pending?: boolean }) {
  const colour = danger ? "bg-red-100 text-red-800" : pending ? "bg-amber-100 text-amber-900" : "bg-[#EAF3FF] text-[#1446A5]";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${colour}`}>{label}</span>;
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}
