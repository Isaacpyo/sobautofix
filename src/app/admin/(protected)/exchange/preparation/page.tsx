import { CalendarPlus, CheckCircle2, CircleAlert, FileText, Wrench } from "lucide-react";
import Link from "next/link";
import { formatDate, formatPounds, inspectionOutcomeLabels, vehicleTitle } from "@/components/admin/exchange/labels";
import { FilterChips } from "@/components/admin/exchange/list-filters";
import { AddPrepItemForm, PreSaleInspectionForm, PrepItemRow } from "@/components/admin/exchange/prep-controls";
import { StockStatusBadge } from "@/components/admin/exchange/stock-badges";
import { Badge, EmptyState, LinkButton, NoAccess, PageHeading, Thumb } from "@/components/admin/exchange/ui";
import { listStaff } from "@/lib/exchange/admin/core";
import { listPreparation } from "@/lib/exchange/admin/prep";
import { requireStaffPage } from "@/lib/exchange/staff";

export default async function PreparationPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { staff, allowed } = await requireStaffPage("exchange.view");
  if (!allowed) return <NoAccess area="preparation" />;
  const params = await searchParams;
  const [entries, staffList] = await Promise.all([listPreparation(staff), listStaff(staff.client)]);
  const show = params.show === "blocked" || params.show === "overdue" ? params.show : "";
  const visible = entries.filter((entry) => show === "blocked" ? !entry.readiness.ready : show === "overdue" ? entry.overdueItems > 0 : true);
  const canEdit = staff.can("prep.manage");
  const today = new Date().toISOString().slice(0, 10);
  const people = staffList.map((member) => ({ id: member.id, name: member.name }));

  return <>
    <PageHeading eyebrow="Workshop" title="Preparation & Inspections" description="Vehicles being prepared for sale, plus live stock with unfinished checklist items. Publishing still needs the checklist on the right of each card." />
    <FilterChips action="/admin/exchange/preparation" param="show" value={show} options={[{ value: "", label: "All", count: entries.length }, { value: "blocked", label: "Not ready to publish", count: entries.filter((entry) => !entry.readiness.ready).length }, { value: "overdue", label: "Overdue items", count: entries.filter((entry) => entry.overdueItems > 0).length }]} />
    {!visible.length ? <div className="mt-4"><EmptyState icon={Wrench} title="Nothing in preparation">Vehicles in Draft or Preparation, and live stock with open checklist items, appear here.</EmptyState></div>
      : <ul className="mt-4 grid gap-4">{visible.map((entry) => <li key={entry.vehicle.id}><article aria-labelledby={`prep-${entry.vehicle.id}`} className="rounded-xl border border-[#E4EAF0] bg-white p-4 sm:p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3"><Thumb url={entry.vehicle.images[0]?.url} alt="" className="w-20" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 id={`prep-${entry.vehicle.id}`} className="font-extrabold text-[#071127]"><Link href={`/admin/exchange/stock/${entry.vehicle.id}`} className="hover:text-[#1462C4]">{vehicleTitle(entry.vehicle)}</Link></h3><StockStatusBadge status={entry.vehicle.status} /></div><p className="text-xs text-[#586575]">{entry.vehicle.stockReference} · {entry.vehicle.price > 0 ? formatPounds(entry.vehicle.price) : "Not priced"}</p></div></div>
          <div className="flex flex-wrap gap-2">
            {staff.can("diary.manage") && <LinkButton href={`/admin/diary/new?kind=preparation&vehicle=${entry.vehicle.id}`} className="min-h-10 px-3 text-xs"><CalendarPlus size={14} aria-hidden="true" />Book workshop time</LinkButton>}
            <LinkButton href={`/admin/exchange/stock/${entry.vehicle.id}?tab=status`} className="min-h-10 px-3 text-xs">Open editor</LinkButton>
          </div>
        </header>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-label="Preparation checklist" className="grid content-start gap-2">
            <div className="flex items-center justify-between"><h4 className="text-sm font-extrabold text-[#071127]">Checklist</h4><span className="text-xs text-[#586575]">{entry.openItems} open{entry.overdueItems ? ` · ${entry.overdueItems} overdue` : ""}</span></div>
            {entry.items.length ? <ul className="grid gap-2">{entry.items.map((item) => <PrepItemRow key={item.id} item={item} staff={people} today={today} canEdit={canEdit} />)}</ul> : <p className="text-sm text-[#586575]">No checklist items yet.</p>}
            {canEdit && <AddPrepItemForm vehicleId={entry.vehicle.id} staff={people} />}
            {canEdit && <PreSaleInspectionForm vehicleId={entry.vehicle.id} inspector={staff.displayName} today={today} />}
          </section>
          <aside className="grid content-start gap-3 rounded-lg bg-[#F8FAFC] p-3">
            <div><h4 className="text-sm font-extrabold text-[#071127]">Ready to sell?</h4><ul className="mt-1.5 grid gap-1">{entry.readiness.checks.map((check) => <li key={check.key} className="flex items-start gap-1.5 text-xs">{check.passed ? <CheckCircle2 size={14} className="mt-px shrink-0 text-[#067647]" aria-hidden="true" /> : <CircleAlert size={14} className="mt-px shrink-0 text-[#B54708]" aria-hidden="true" />}<span className={check.passed ? "text-[#586575]" : "font-bold text-[#071127]"}>{check.label}</span></li>)}</ul></div>
            <div className="border-t border-[#E4EAF0] pt-2"><h4 className="text-sm font-extrabold text-[#071127]">Inspections</h4>{entry.inspections.length ? <ul className="mt-1 grid gap-1">{entry.inspections.slice(0, 3).map((inspection) => <li key={inspection.id} className="text-xs text-[#344054]">{formatDate(inspection.inspected_on)} · {inspectionOutcomeLabels[inspection.outcome as keyof typeof inspectionOutcomeLabels]} · {inspection.inspector_name}</li>)}</ul> : <p className="text-xs text-[#586575]">No pre-sale inspection recorded.</p>}</div>
            <div className="border-t border-[#E4EAF0] pt-2"><Link href={`/admin/exchange/stock/${entry.vehicle.id}?tab=documents`} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-extrabold text-[#1462C4]"><FileText size={14} aria-hidden="true" />{entry.documents} {entry.documents === 1 ? "document" : "documents"}</Link></div>
            {entry.readiness.ready ? <Badge tone="success">Ready to publish</Badge> : <Badge tone="warning">{entry.readiness.missing.length} to finish before publishing</Badge>}
          </aside>
        </div>
      </article></li>)}</ul>}
  </>;
}
