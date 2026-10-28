import { AlarmClock, CalendarDays, CalendarPlus, CarFront, ChevronRight, Eye, HandCoins, Inbox, KeyRound, UsersRound, Wrench, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DiaryEntryCard } from "@/components/admin/diary/diary-badges";
import { LoadFailedNotice, NotPermitted, SchemaMissingNotice } from "@/components/admin/diary/diary-states";
import { customerDisplayName, relation, saleVehicleLabel, type CustomerRelation, type SaleVehicleRelation } from "@/lib/diary/mapping";
import { loadDiaryEntries, loadStaffDirectory, staffNameMap } from "@/lib/diary/repository";
import { addDays, formatDateKeyLong, formatLondonDateTime, londonMidnight, londonTimeKey, todayInLondon } from "@/lib/diary/time";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { requireStaffPage } from "@/lib/exchange/staff";
import { RetryNotificationButton, RunSweepButton } from "@/components/admin/diary/notification-retry";
import { retryStateLabel } from "@/lib/notifications/retry-policy";
import { listFailedNotifications } from "@/lib/notifications/retry-sweep";
import { retryNotificationNowAction, runRetrySweepNowAction } from "./actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

type EnquiryRow = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  follow_up_at?: string | null;
  sales_stage?: string | null;
  customers: CustomerRelation | CustomerRelation[] | null;
  sale_vehicles?: SaleVehicleRelation | SaleVehicleRelation[] | null;
  vehicles: { make: string | null; model: string | null } | Array<{ make: string | null; model: string | null }> | null;
};

type Lane = "buying" | "sales" | "workshop";

function laneOf(type: string): Lane {
  if (type === "vehicle_purchase") return "buying";
  if (type === "vehicle_sales") return "sales";
  return "workshop";
}

const laneLabels: Record<Lane, string> = { buying: "Buying", sales: "Sales", workshop: "Workshop" };
const laneIcons: Record<Lane, LucideIcon> = { buying: HandCoins, sales: KeyRound, workshop: Wrench };
const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { staff, allowed } = await requireStaffPage("diary.manage");
  if (!allowed) return <NotPermitted what="Today" />;
  const mine = (await searchParams).who === "mine";
  const today = todayInLondon();
  const dayStart = londonMidnight(today).toISOString();
  const dayEnd = londonMidnight(addDays(today, 1)).toISOString();
  const canBuying = staff.can("buying.manage");
  const canSales = staff.can("sales.manage");
  const lanes: Lane[] = [...(canSales ? (["sales"] as const) : []), ...(canBuying ? (["buying"] as const) : []), "workshop"];

  const [directory, failedNotifications] = await Promise.all([
    loadStaffDirectory(staff.client),
    canSales || canBuying ? listFailedNotifications(staff.client) : Promise.resolve({ rows: [], schemaMissing: false }),
  ]);
  const failedRows = failedNotifications.rows.filter((row) => (row.type === "vehicle_sales" ? canSales : canBuying));
  const enquiryColumns = "id,type,status,created_at,customers(name,anonymised_at),vehicles(make,model)";
  const exchangeColumns = `${enquiryColumns},follow_up_at,sales_stage,sale_vehicles(make,model,year,stock_reference)`;
  const [agenda, requests, newEnquiriesFull, followUps] = await Promise.all([
    loadDiaryEntries(staff.client, dayStart, dayEnd, staff.role, staffNameMap(directory)),
    canSales ? staff.client.from("diary_appointments").select("id,title,starts_at,customers(name,anonymised_at)", { count: "exact" }).is("deleted_at", null).eq("kind", "viewing").eq("status", "requested").order("starts_at").limit(5) : Promise.resolve(null),
    staff.client.from("enquiries").select(exchangeColumns).is("deleted_at", null).eq("status", "new").order("created_at", { ascending: false }).limit(40),
    canSales || canBuying ? staff.client.from("enquiries").select(exchangeColumns).is("deleted_at", null).neq("status", "closed").lt("follow_up_at", dayEnd).order("follow_up_at").limit(20) : Promise.resolve(null),
  ]);

  // Before the exchange migration, fall back to the columns that already exist.
  let newEnquiries = (newEnquiriesFull.data || []) as unknown as EnquiryRow[];
  const schemaMissing = isMissingSchemaError(newEnquiriesFull.error) || agenda.schemaMissing;
  if (newEnquiriesFull.error && isMissingSchemaError(newEnquiriesFull.error)) {
    const fallback = await staff.client.from("enquiries").select(enquiryColumns).is("deleted_at", null).eq("status", "new").order("created_at", { ascending: false }).limit(40);
    newEnquiries = (fallback.data || []) as unknown as EnquiryRow[];
  }
  newEnquiries = newEnquiries.filter((row) => lanes.includes(laneOf(row.type)));
  const followUpRows = (((followUps?.error ? [] : followUps?.data) || []) as unknown as EnquiryRow[]).filter((row) => lanes.includes(laneOf(row.type)));
  const submissionIds = await submissionsFor(staff.client, [...newEnquiries, ...followUpRows, ...failedRows].filter((row) => row.type === "vehicle_purchase").map((row) => row.id));

  const entries = agenda.entries.filter((entry) => entry.status !== "cancelled" && (!mine || entry.assignedTo === staff.userId));
  const requestRows = ((requests?.data || []) as unknown as Array<{ id: string; title: string; starts_at: string; customers: CustomerRelation | CustomerRelation[] | null }>);
  const requestCount = requests?.count ?? requestRows.length;

  const enquiryHref = (row: EnquiryRow) => {
    const lane = laneOf(row.type);
    if (lane === "sales") return `/admin/exchange/sales/${row.id}`;
    if (lane === "buying") return submissionIds.get(row.id) ? `/admin/exchange/buying/${submissionIds.get(row.id)}` : `/admin/enquiries/${row.id}`;
    return `/admin/enquiries/${row.id}`;
  };
  const vehicleOf = (row: EnquiryRow) => saleVehicleLabel(relation(row.sale_vehicles ?? null)) ?? ([relation(row.vehicles)?.make, relation(row.vehicles)?.model].filter(Boolean).join(" ") || null);

  const quickLinks: Array<{ href: string; label: string; icon: LucideIcon; show: boolean }> = [
    { href: "/admin/diary/new", label: "New appointment", icon: CalendarPlus, show: true },
    { href: "/admin/diary", label: "Diary", icon: CalendarDays, show: true },
    { href: "/admin/exchange/viewings", label: "Viewings", icon: Eye, show: staff.can("exchange.view") },
    { href: "/admin/exchange/stock", label: "Stock", icon: CarFront, show: staff.can("exchange.view") },
    { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, show: true },
    { href: "/admin/customers", label: "Customers", icon: UsersRound, show: staff.can("customers.view") },
  ];

  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <header>
        <p className="text-xs font-extrabold tracking-widest text-[#1462C4] uppercase">{formatDateKeyLong(today)}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-[#0B1220] sm:text-4xl">Today</h1>
        <p className="mt-1 text-sm text-[#5B6575]">Hello {staff.displayName.split(" ")[0]}. Here is what needs you today.</p>
      </header>

      {schemaMissing && <SchemaMissingNotice />}
      {agenda.failed && <LoadFailedNotice what="today's diary" />}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
        <Stat href="#agenda" label="In the diary" value={entries.length} />
        {canSales && <Stat href="/admin/exchange/viewings" label="Viewing requests" value={requestCount} tone={requestCount ? "amber" : undefined} />}
        <Stat href="#new-enquiries" label="New enquiries" value={newEnquiries.length} tone={newEnquiries.length ? "blue" : undefined} />
        {(canSales || canBuying) && <Stat href="#follow-ups" label="Follow-ups due" value={followUpRows.length} tone={followUpRows.length ? "red" : undefined} />}
      </ul>

      <section id="agenda" aria-labelledby="agenda-heading" className="grid grid-cols-1 scroll-mt-24 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="agenda-heading" className="text-xl font-extrabold text-[#0B1220]">Today&apos;s agenda</h2>
          <nav aria-label="Whose appointments" className="flex rounded-xl border border-[#D0D5DD] bg-white p-1">
            <Link href="/admin/today" aria-current={!mine ? "page" : undefined} className={cn("flex min-h-10 items-center rounded-lg px-3 text-sm font-bold", !mine ? "bg-[#1974E2] text-white" : "text-[#344054] hover:bg-[#F3F5F8]", focusRing)}>Everyone</Link>
            <Link href="/admin/today?who=mine" aria-current={mine ? "page" : undefined} className={cn("flex min-h-10 items-center rounded-lg px-3 text-sm font-bold", mine ? "bg-[#1974E2] text-white" : "text-[#344054] hover:bg-[#F3F5F8]", focusRing)}>Mine</Link>
          </nav>
        </div>
        {entries.length ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {entries.map((entry) => <li key={entry.key}><DiaryEntryCard entry={entry} /></li>)}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white px-4 py-5 text-sm text-[#5B6575]">{mine ? "Nothing assigned to you today." : "Nothing in the diary today."} <Link href="/admin/diary/new" className="font-bold text-[#1462C4] underline">Add an appointment</Link></p>
        )}
      </section>

      {canSales && (
        <section aria-labelledby="requests-heading" className="grid grid-cols-1 gap-3">
          <SectionHeading id="requests-heading" title="Viewing requests to confirm" href="/admin/exchange/viewings" linkLabel="All viewings" />
          {requestRows.length ? (
            <ul className="grid grid-cols-1 gap-2">
              {requestRows.map((row) => (
                <li key={row.id}>
                  <RowLink href={`/admin/diary/${row.id}`} title={row.title} detail={`${customerDisplayName(relation(row.customers)) ?? "Customer"} · asked for ${formatLondonDateTime(row.starts_at)}`} badge="Requested" />
                </li>
              ))}
            </ul>
          ) : <Empty>No viewing requests waiting.</Empty>}
        </section>
      )}

      {failedRows.length > 0 && (
        <section aria-labelledby="failed-heading" className="grid grid-cols-1 gap-3 rounded-2xl border border-[#FECDCA] bg-[#FEF3F2]/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="failed-heading" className="text-xl font-extrabold text-[#0B1220]">Notifications that failed</h2>
              <p className="text-sm text-[#344054]">These enquiries are saved. Their emails will be retried automatically up to 3 times; you can also retry now.</p>
            </div>
            {canSales && <RunSweepButton action={runRetrySweepNowAction} />}
          </div>
          <ul className="grid grid-cols-1 gap-2">
            {failedRows.map((row) => {
              const name = customerDisplayName(relation(row.customers)) ?? "Customer";
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-[#FECDCA]">
                  <div className="min-w-0 flex-1">
                    <Link href={enquiryHref({ ...row, status: "new", vehicles: null, customers: row.customers } as EnquiryRow)} className="font-bold text-[#0B1220] hover:underline">{name}</Link>
                    <p className="text-sm text-[#5B6575]">{row.type === "vehicle_sales" ? "Sales enquiry" : "Buying enquiry"} · {row.notification_attempt_count} {row.notification_attempt_count === 1 ? "retry" : "retries"} · {retryStateLabel(row)}</p>
                  </div>
                  <RetryNotificationButton enquiryId={row.id} label={name} action={retryNotificationNowAction} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section id="new-enquiries" aria-labelledby="enquiries-heading" className="grid grid-cols-1 scroll-mt-24 gap-3">
        <SectionHeading id="enquiries-heading" title="New enquiries" href="/admin/enquiries" linkLabel="All enquiries" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {lanes.map((lane) => {
            const rows = newEnquiries.filter((row) => laneOf(row.type) === lane);
            const Icon = laneIcons[lane];
            return (
              <div key={lane} className="rounded-2xl border border-[#E3E8EF] bg-white p-3">
                <h3 className="flex items-center gap-2 px-1 text-sm font-extrabold text-[#0B1220]"><Icon size={17} className="text-[#1974E2]" aria-hidden="true" /> {laneLabels[lane]} <span className="ml-auto rounded-full bg-[#F3F5F8] px-2 text-xs text-[#344054]">{rows.length}</span></h3>
                {rows.length ? (
                  <ul className="mt-2 grid grid-cols-1 gap-1">
                    {rows.slice(0, 6).map((row) => (
                      <li key={row.id}><RowLink href={enquiryHref(row)} title={customerDisplayName(relation(row.customers)) ?? "Customer"} detail={[vehicleOf(row), `received ${formatReceived(row.created_at, today)}`].filter(Boolean).join(" · ")} compact /></li>
                    ))}
                  </ul>
                ) : <p className="px-1 pt-2 pb-1 text-sm text-[#5B6575]">None new.</p>}
              </div>
            );
          })}
        </div>
      </section>

      {(canSales || canBuying) && (
        <section id="follow-ups" aria-labelledby="follow-heading" className="grid grid-cols-1 scroll-mt-24 gap-3">
          <SectionHeading id="follow-heading" title="Follow-ups due" />
          {followUpRows.length ? (
            <ul className="grid grid-cols-1 gap-2">
              {followUpRows.map((row) => {
                const overdue = row.follow_up_at ? Date.parse(row.follow_up_at) < Date.parse(dayStart) : false;
                return (
                  <li key={row.id}>
                    <RowLink href={enquiryHref(row)} title={customerDisplayName(relation(row.customers)) ?? "Customer"} detail={[laneLabels[laneOf(row.type)], vehicleOf(row), row.follow_up_at ? `${overdue ? "was due" : "due"} ${formatReceived(row.follow_up_at, today)}` : null].filter(Boolean).join(" · ")} badge={overdue ? "Overdue" : "Due today"} badgeTone={overdue ? "red" : "amber"} icon={AlarmClock} />
                  </li>
                );
              })}
            </ul>
          ) : <Empty>No follow-ups due.</Empty>}
        </section>
      )}

      <section aria-labelledby="quick-heading" className="grid grid-cols-1 gap-3">
        <h2 id="quick-heading" className="text-xl font-extrabold text-[#0B1220]">Quick links</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickLinks.filter((link) => link.show).map(({ href, label, icon: Icon }) => (
            <li key={href}><Link href={href} className={cn("flex min-h-14 items-center gap-3 rounded-2xl border border-[#E3E8EF] bg-white px-4 font-bold text-[#0B1220] hover:border-[#1974E2]", focusRing)}><Icon size={19} className="text-[#1974E2]" aria-hidden="true" />{label}</Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function formatReceived(value: string, today: string) {
  const date = new Date(value);
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(date);
  if (key === today) return `today ${londonTimeKey(value)}`;
  if (key === addDays(today, -1)) return `yesterday ${londonTimeKey(value)}`;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(date);
}

async function submissionsFor(client: Awaited<ReturnType<typeof requireStaffPage>>["staff"]["client"], enquiryIds: string[]) {
  const map = new Map<string, string>();
  if (!enquiryIds.length) return map;
  const { data } = await client.from("seller_submissions").select("id,enquiry_id").in("enquiry_id", enquiryIds);
  for (const row of (data || []) as Array<{ id: string; enquiry_id: string | null }>) if (row.enquiry_id) map.set(row.enquiry_id, row.id);
  return map;
}

function Stat({ href, label, value, tone }: { href: string; label: string; value: number; tone?: "amber" | "blue" | "red" }) {
  return (
    <li>
      <Link href={href} className={cn("block rounded-2xl border bg-white p-4 hover:border-[#1974E2]", tone === "amber" ? "border-[#FEDF89]" : tone === "red" ? "border-[#FECDCA]" : tone === "blue" ? "border-[#BCD6F6]" : "border-[#E3E8EF]", focusRing)}>
        <span className="block text-3xl font-extrabold text-[#0B1220]">{value}</span>
        <span className="mt-1 block text-sm font-semibold text-[#344054]">{label}</span>
      </Link>
    </li>
  );
}

function SectionHeading({ id, title, href, linkLabel }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-xl font-extrabold text-[#0B1220]">{title}</h2>
      {href && <Link href={href} className={cn("inline-flex min-h-11 items-center text-sm font-bold text-[#1462C4] hover:underline", focusRing)}>{linkLabel}</Link>}
    </div>
  );
}

function RowLink({ href, title, detail, badge, badgeTone = "amber", compact, icon: Icon }: { href: string; title: string; detail: string; badge?: string; badgeTone?: "amber" | "red"; compact?: boolean; icon?: LucideIcon }) {
  return (
    <Link href={href} className={cn("flex min-h-14 items-center gap-3 rounded-xl bg-white px-3 py-2 hover:bg-[#F5F9FF]", !compact && "border border-[#E3E8EF]", focusRing)}>
      {Icon && <Icon size={18} className="shrink-0 text-[#5B6575]" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-[#0B1220]">{title}</span>
        <span className="line-clamp-2 block text-sm text-[#5B6575]">{detail}</span>
      </span>
      {badge && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", badgeTone === "red" ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#FFFAEB] text-[#93370D]")}>{badge}</span>}
      <ChevronRight size={18} className="shrink-0 text-[#1974E2]" aria-hidden="true" />
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white px-4 py-4 text-sm text-[#5B6575]">{children}</p>;
}
