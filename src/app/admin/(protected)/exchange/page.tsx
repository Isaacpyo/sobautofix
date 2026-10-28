import { ArrowRight, BadgeCheck, CalendarClock, CarFront, CheckCircle2, ClipboardList, Handshake, Inbox, MailWarning, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/components/admin/exchange/labels";
import { ActionForm, SubmitButton } from "@/components/admin/exchange/forms";
import { Badge, Card, LinkButton, NoAccess, PageHeading, StatTile } from "@/components/admin/exchange/ui";
import { getExchangeOverview, type AttentionGroup } from "@/lib/exchange/admin/overview";
import { requireStaffPage } from "@/lib/exchange/staff";
import { cn } from "@/lib/utils";
import { retryExchangeNotificationAction } from "./actions";

export default async function ExchangeOverviewPage() {
  const { staff, allowed } = await requireStaffPage("exchange.view");
  if (!allowed) return <NoAccess area="Vehicle Buying & Selling" />;
  const overview = await getExchangeOverview(staff);
  const attention = overview.groups.filter((group) => group.count > 0);
  const calm = overview.groups.filter((group) => group.count === 0);

  return <>
    <PageHeading eyebrow="Overview" title="What needs attention" description="Everything below links to the record. Counts update as staff work through enquiries, stock and sales." actions={<>
      {staff.can("stock.edit") && <LinkButton href="/admin/exchange/stock/new" variant="primary"><Plus size={17} aria-hidden="true" />Add vehicle</LinkButton>}
      {staff.can("buying.manage") && <LinkButton href="/admin/exchange/enquiries/new?type=buying"><Plus size={17} aria-hidden="true" />Buying enquiry</LinkButton>}
      {staff.can("sales.manage") && <LinkButton href="/admin/exchange/enquiries/new?type=sales"><Plus size={17} aria-hidden="true" />Sales enquiry</LinkButton>}
    </>} />

    <section aria-label="Stock and pipeline totals" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Available" value={overview.counts.available} support="Live listings" href="/admin/exchange/stock?status=available" icon={CarFront} />
      <StatTile label="Reserved" value={overview.counts.reserved} support="Awaiting handover" href="/admin/exchange/stock?status=reserved" icon={Handshake} />
      <StatTile label="Preparation" value={overview.counts.preparation} support={`${overview.counts.drafts} more in draft`} href="/admin/exchange/preparation" icon={Wrench} />
      <StatTile label="Buying pipeline" value={overview.counts.openBuying} support="Open seller enquiries" href="/admin/exchange/buying" icon={Inbox} />
      <StatTile label="Sales pipeline" value={overview.counts.openSales} support="Open buyer enquiries" href="/admin/exchange/sales" icon={ClipboardList} />
      <StatTile label="Active sales" value={overview.counts.activeSales} support="Reserved to handover" href="/admin/exchange/handover" icon={BadgeCheck} />
    </section>

    {overview.notificationFailures.length > 0 && <Card className="mt-6 border-red-200" title={<span className="flex items-center gap-2"><MailWarning size={19} className="text-[#B42318]" aria-hidden="true" />Notification emails that failed</span>} description="The enquiry was saved, but the email to staff or the customer did not send. Retry once the email service is working.">
      <ul className="divide-y divide-[#EEF2F6]">{overview.notificationFailures.map((failure) => <li key={failure.enquiryId} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><Link href={failure.href} className="font-bold text-[#071127] hover:text-[#1462C4]">{failure.title}</Link><p className="text-xs text-[#667586]">Received {formatDateTime(failure.createdAt)}</p></div>
        <ActionForm action={retryExchangeNotificationAction} hidden={{ enquiryId: failure.enquiryId }} className="max-w-xs"><SubmitButton variant="secondary" pendingLabel="Retrying…" className="min-h-10">Retry email</SubmitButton></ActionForm>
      </li>)}</ul>
    </Card>}

    <h3 className="mt-8 text-lg font-extrabold text-[#071127]">Needs attention</h3>
    {attention.length ? <div className="mt-3 grid gap-4 lg:grid-cols-2">{attention.map((group) => <AttentionCard key={group.key} group={group} />)}</div>
      : <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-900"><CheckCircle2 size={20} aria-hidden="true" />Nothing needs attention right now.</div>}

    {calm.length > 0 && <section aria-label="Up to date" className="mt-6">
      <h3 className="text-sm font-extrabold tracking-wide text-[#667586] uppercase">Up to date</h3>
      <ul className="mt-2 flex flex-wrap gap-2">{calm.map((group) => <li key={group.key}><Link href={group.href} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#E4EAF0] bg-white px-3.5 text-sm font-semibold text-[#344054] hover:border-[#1974E2]"><CheckCircle2 size={15} className="text-[#067647]" aria-hidden="true" />{group.title}</Link></li>)}</ul>
    </section>}

    <div className="mt-8 grid gap-3 sm:grid-cols-2">
      <Link href="/admin/diary" className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#E4EAF0] bg-white px-4 font-bold text-[#071127] hover:border-[#1974E2]"><span className="flex items-center gap-3"><CalendarClock size={19} className="text-[#1974E2]" aria-hidden="true" />Open the Autofix Diary</span><ArrowRight size={17} aria-hidden="true" /></Link>
      <Link href="/admin/exchange/viewings" className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#E4EAF0] bg-white px-4 font-bold text-[#071127] hover:border-[#1974E2]"><span className="flex items-center gap-3"><CalendarClock size={19} className="text-[#1974E2]" aria-hidden="true" />Viewings &amp; Appointments</span><ArrowRight size={17} aria-hidden="true" /></Link>
    </div>
  </>;
}

function AttentionCard({ group }: { group: AttentionGroup }) {
  const accent = group.tone === "danger" ? "border-l-[#B42318]" : group.tone === "warning" ? "border-l-[#DC6803]" : "border-l-[#1974E2]";
  return <section aria-labelledby={`attention-${group.key}`} className={cn("rounded-xl border border-l-4 border-[#E4EAF0] bg-white p-4", accent)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h4 id={`attention-${group.key}`} className="font-extrabold text-[#071127]">{group.title}</h4><p className="mt-0.5 text-xs leading-5 text-[#667586]">{group.description}</p></div>
      <Badge tone={group.tone === "danger" ? "danger" : group.tone === "warning" ? "warning" : "info"} className="text-sm">{group.count}</Badge>
    </div>
    <ul className="mt-3 divide-y divide-[#EEF2F6]">{group.items.map((item) => <li key={item.id}><Link href={item.href} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:text-[#1462C4]">
      <span className="min-w-0"><span className="block truncate text-sm font-bold text-[#071127]">{item.title}</span><span className="block truncate text-xs text-[#586575]">{item.detail}</span></span>
      {item.when && <span className={cn("shrink-0 text-xs font-bold", item.tone === "danger" ? "text-[#B42318]" : "text-[#586575]")}>{item.when.length === 10 ? formatDate(item.when) : formatDateTime(item.when)}</span>}
    </Link></li>)}</ul>
    {group.count > group.items.length && <Link href={group.href} className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-[#1462C4]">View all {group.count}<ArrowRight size={15} aria-hidden="true" /></Link>}
  </section>;
}
