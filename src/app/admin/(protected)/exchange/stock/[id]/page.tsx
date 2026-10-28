import { CalendarPlus, CheckCircle2, CircleAlert, ExternalLink, History, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime, formatPounds, inspectionOutcomeLabels, prepStatusLabels, prepStatusTones, stockStatusLabels, vehicleSaleStatusLabels, vehicleSaleStatusTones, vehicleTitle } from "@/components/admin/exchange/labels";
import { StockStatusBadge } from "@/components/admin/exchange/stock-badges";
import { ConditionForm, CostLineForm, CostRowActions, DocumentList, DocumentUploader, InternalForm, ListingForm, PhotoManager, StatusPanel } from "@/components/admin/exchange/stock-editor";
import { Badge, Card, KeyValues, LinkButton, NoAccess, Notice } from "@/components/admin/exchange/ui";
import { BackLink } from "@/components/ui/back-link";
import { costCategoryLabels, formatPence, MARGIN_DEFINITION } from "@/lib/exchange/margin";
import { stockTransitions } from "@/lib/exchange/readiness";
import { activeSaleFor, getStockDetail, type HistoryEntry } from "@/lib/exchange/admin/stock";
import { statusChangeProblem } from "@/lib/exchange/admin/stock-rules";
import { exchangeHref } from "@/lib/exchange/host";
import { requireStaffPage } from "@/lib/exchange/staff";
import { formatRegistration } from "@/lib/vehicle/registration-format";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "listing", label: "Listing" },
  { key: "photos", label: "Photos" },
  { key: "condition", label: "Condition & disclosure" },
  { key: "status", label: "Status & publishing" },
  { key: "internal", label: "Internal", finance: true },
  { key: "costs", label: "Costs", finance: true },
  { key: "documents", label: "Documents" },
  { key: "history", label: "History" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

export default async function StockEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { staff, allowed } = await requireStaffPage("exchange.view");
  if (!allowed) return <NoAccess area="Vehicle Stock" />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const detail = await getStockDetail(staff, id);
  if (!detail) notFound();
  const { vehicle, readiness } = detail;
  const finance = staff.can("finance.view");
  const visibleTabs = tabs.filter((tab) => !("finance" in tab) || finance);
  const tab: TabKey = visibleTabs.some((item) => item.key === query.tab) ? (query.tab as TabKey) : "listing";
  const activeSale = activeSaleFor(detail.sales);
  const completedSale = detail.sales.find((sale) => sale.status === "completed");
  const title = vehicleTitle(vehicle);
  const publicHref = exchangeHref("/exchange", `/cars/${vehicle.slug}`);
  const canEdit = staff.can("stock.edit");
  const statusOptions = stockTransitions[vehicle.status].map((status) => ({
    status,
    blockedReason: statusChangeProblem({ from: vehicle.status, to: status, can: staff.can, readiness, hasActiveSale: Boolean(activeSale), hasCompletedSale: Boolean(completedSale) }),
  }));

  return <>
    <BackLink href="/admin/exchange/stock">Back to Vehicle Stock</BackLink>
    <header className="mt-3 rounded-xl border border-[#E4EAF0] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- public stock photo */}
          {vehicle.images[0] ? <img src={vehicle.images[0].url} alt="" className="hidden aspect-[4/3] w-32 rounded-lg object-cover sm:block" /> : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><StockStatusBadge status={vehicle.status} />{readiness.ready ? <Badge tone="success"><CheckCircle2 size={13} aria-hidden="true" />Checklist complete</Badge> : <Badge tone="warning"><CircleAlert size={13} aria-hidden="true" />{readiness.missing.length} to publish</Badge>}</div>
            <h2 className="mt-2 text-2xl font-extrabold text-[#071127] sm:text-3xl">{title}</h2>
            <p className="mt-0.5 text-sm text-[#586575]">{[vehicle.derivative, vehicle.stockReference, vehicle.registration ? formatRegistration(vehicle.registration) : null].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-[#071127]">{vehicle.price > 0 ? formatPounds(vehicle.price) : "Not priced"}</p>
          <p className="text-xs font-semibold text-[#586575]">{detail.daysInStock} days in stock · {detail.enquiryCount} {detail.enquiryCount === 1 ? "enquiry" : "enquiries"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(vehicle.status === "available" || vehicle.status === "reserved" || vehicle.status === "sold") && <LinkButton href={publicHref} className="min-h-10"><ExternalLink size={15} aria-hidden="true" />View public listing</LinkButton>}
        {staff.can("prep.manage") && <LinkButton href={`/admin/diary/new?kind=preparation&vehicle=${vehicle.id}`} className="min-h-10"><CalendarPlus size={15} aria-hidden="true" />Book preparation</LinkButton>}
        {activeSale && <LinkButton href={`/admin/exchange/handover/${activeSale.id}`} className="min-h-10">Open reservation ({vehicleSaleStatusLabels[activeSale.status as keyof typeof vehicleSaleStatusLabels]})</LinkButton>}
        {!activeSale && vehicle.status === "available" && staff.can("sales.manage") && <LinkButton href={`/admin/exchange/handover?reserve=${vehicle.id}`} className="min-h-10">Reserve this vehicle</LinkButton>}
      </div>
    </header>

    <nav aria-label="Vehicle record sections" className="mt-4 -mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <ul className="flex gap-1.5">{visibleTabs.map((item) => <li key={item.key} className="shrink-0"><Link href={`/admin/exchange/stock/${vehicle.id}?tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold whitespace-nowrap", tab === item.key ? "border-[#1974E2] bg-[#1974E2] text-white" : "border-[#D7E0E9] bg-white text-[#344054] hover:border-[#1974E2]")}>{"finance" in item && <Lock size={13} aria-hidden="true" />}{item.label}{item.key === "photos" && <span className="text-xs opacity-80">({vehicle.images.length})</span>}</Link></li>)}</ul>
    </nav>

    <div className="mt-4">
      {tab === "listing" && <Card title="Listing" description="Specifications, price, description and features shown to customers.">{canEdit ? <ListingForm vehicle={vehicle} canEditPrice={staff.can("stock.price")} /> : <ReadOnly />}</Card>}
      {tab === "photos" && <Card title="Photos" description="Order, cover photo and descriptions. Changes show on the website straight away for live listings.">{canEdit ? <PhotoManager vehicleId={vehicle.id} photos={vehicle.images} minimumPhotos={detail.minimumPhotos} /> : <ReadOnly />}</Card>}
      {tab === "condition" && <Card title="Condition & disclosure" description="Everything here is public on the listing. Leave a field blank or Not confirmed if you do not know; never guess.">{canEdit ? <ConditionForm vehicle={vehicle} /> : <ReadOnly />}</Card>}
      {tab === "status" && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <Card title="Status & publishing" description={`Currently ${stockStatusLabels[vehicle.status]}${vehicle.listedAt ? `. First listed ${formatDate(vehicle.listedAt)}` : ""}.`}><StatusPanel vehicle={vehicle} allowed={statusOptions} /></Card>
        <Card title="Publishing checklist" description={`Needed before the vehicle can be Available.`}>
          <ul className="grid gap-2">{readiness.checks.map((check) => <li key={check.key} className="flex items-start gap-2 text-sm">{check.passed ? <CheckCircle2 size={18} className="mt-px shrink-0 text-[#067647]" aria-hidden="true" /> : <CircleAlert size={18} className="mt-px shrink-0 text-[#B54708]" aria-hidden="true" />}<span className={check.passed ? "text-[#344054]" : "font-bold text-[#071127]"}>{check.label}<span className="sr-only">{check.passed ? ": done" : ": missing"}</span></span></li>)}</ul>
          {detail.prepItems.length > 0 && <div className="mt-5 border-t border-[#EEF2F6] pt-4"><h4 className="text-sm font-extrabold text-[#071127]">Preparation checklist</h4><ul className="mt-2 grid gap-1.5">{detail.prepItems.map((item) => <li key={item.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{item.title}</span><Badge tone={prepStatusTones[item.status as keyof typeof prepStatusTones]}>{prepStatusLabels[item.status as keyof typeof prepStatusLabels]}</Badge></li>)}</ul><Link href="/admin/exchange/preparation" className="mt-2 inline-flex min-h-10 items-center text-sm font-extrabold text-[#1462C4]">Manage in Preparation &amp; Inspections</Link></div>}
        </Card>
        {detail.sales.length > 0 && <Card className="lg:col-span-2" title="Sales records"><ul className="divide-y divide-[#EEF2F6]">{detail.sales.map((sale) => <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link href={`/admin/exchange/handover/${sale.id}`} className="font-bold text-[#1462C4]">Reserved {formatDate(sale.reserved_at)}</Link><Badge tone={vehicleSaleStatusTones[sale.status as keyof typeof vehicleSaleStatusTones]}>{vehicleSaleStatusLabels[sale.status as keyof typeof vehicleSaleStatusLabels]}</Badge></li>)}</ul></Card>}
      </div>}
      {tab === "internal" && finance && <Card title="Internal record" description="Acquisition details and notes. Visible to owners and managers only."><InternalForm vehicleId={vehicle.id} internal={detail.internal} canEdit={staff.can("finance.edit")} />{detail.internal?.seller_submission_id && <p className="mt-3 text-sm"><Link className="font-bold text-[#1462C4]" href={`/admin/exchange/buying/${detail.internal.seller_submission_id}`}>Open the buying enquiry this car came from</Link></p>}</Card>}
      {tab === "costs" && finance && detail.margin && <div className="grid gap-4">
        <Card title="Gross margin" description={MARGIN_DEFINITION}>
          <KeyValues columns={3} items={[
            { label: "Purchase", value: detail.margin.hasPurchaseCost ? formatPence(detail.margin.purchasePence) : <span className="text-[#B54708]">Not recorded</span> },
            { label: "Direct costs", value: formatPence(detail.margin.directCostsPence) },
            { label: detail.margin.sellingPriceSource === "advertised" ? "Advertised price" : detail.margin.sellingPriceSource === "agreed_sale" ? "Agreed price" : "Sold price", value: formatPence(detail.margin.sellingPricePence) },
            { label: "Gross margin", value: <span className={detail.margin.grossMarginPence < 0 ? "text-[#B42318]" : ""}>{formatPence(detail.margin.grossMarginPence)}{detail.margin.marginPercent !== null ? ` (${detail.margin.marginPercent}%)` : ""}</span> },
            { label: "Basis", value: <Badge tone={detail.margin.basis === "actual" ? "success" : "warning"}>{detail.margin.basis === "actual" ? "Actual" : "Estimated"}</Badge> },
          ]} />
        </Card>
        <Card title="Cost lines" description="Amounts in pounds. Mark a line Estimated until you have the invoice.">
          {detail.costs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><caption className="sr-only">Cost lines</caption><thead className="text-xs font-extrabold tracking-wide text-[#586575] uppercase"><tr><th scope="col" className="py-2 pr-3">Category</th><th scope="col" className="py-2 pr-3">Description</th><th scope="col" className="py-2 pr-3">Date</th><th scope="col" className="py-2 pr-3">Basis</th><th scope="col" className="py-2 pr-3 text-right">Amount</th>{staff.can("finance.edit") && <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>{detail.costs.map((cost) => <tr key={cost.id} className="border-t border-[#EEF2F6] align-top"><td className="py-2 pr-3 font-bold">{costCategoryLabels[cost.category]}</td><td className="py-2 pr-3">{cost.description}</td><td className="py-2 pr-3 text-[#586575]">{formatDate(cost.incurred_on, "—")}</td><td className="py-2 pr-3"><Badge tone={cost.basis === "actual" ? "success" : "warning"}>{cost.basis === "actual" ? "Actual" : "Estimated"}</Badge></td><td className="py-2 pr-3 text-right font-extrabold">{formatPence(cost.amount_pence)}</td>{staff.can("finance.edit") && <td className="py-2"><CostRowActions vehicleId={vehicle.id} cost={cost} /></td>}</tr>)}</tbody></table></div> : <p className="rounded-xl bg-[#F4F7FA] p-4 text-sm text-[#586575]">No costs recorded yet.</p>}
          {staff.can("finance.edit") && <div className="mt-5 border-t border-[#EEF2F6] pt-4"><h4 className="mb-3 text-sm font-extrabold text-[#071127]">Add a cost</h4><CostLineForm vehicleId={vehicle.id} /></div>}
        </Card>
      </div>}
      {tab === "documents" && <div className="grid gap-4">
        <Card title="Documents" description="Private files: V5C, service records, MOT certificates, inspection reports and invoices. Never shown to customers.">
          {staff.can("stock.edit") || staff.can("prep.manage") ? <DocumentList documents={detail.documents} canDelete={staff.can("prep.manage")} /> : <ReadOnly />}
          {staff.can("prep.manage") && <div className="mt-4"><DocumentUploader vehicleId={vehicle.id} canFinance={staff.can("finance.view")} /></div>}
        </Card>
        <Card title="Inspections" description="Recorded inspections for this vehicle.">{detail.inspections.length ? <ul className="grid gap-3">{detail.inspections.map((inspection) => <li key={inspection.id} className="rounded-xl border border-[#E4EAF0] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-[#071127]">{inspection.kind === "purchase" ? "Purchase inspection" : "Pre-sale inspection"} · {formatDate(inspection.inspected_on)}</p><Badge tone={inspection.outcome === "not_satisfactory" ? "danger" : inspection.outcome === "advisories" ? "warning" : "success"}>{inspectionOutcomeLabels[inspection.outcome as keyof typeof inspectionOutcomeLabels]}</Badge></div><p className="mt-1 text-sm text-[#344054]">{inspection.findings}</p><p className="mt-1 text-xs text-[#586575]">By {inspection.inspector_name}</p></li>)}</ul> : <p className="text-sm text-[#586575]">No inspections recorded. Record a pre-sale inspection in <Link href="/admin/exchange/preparation" className="font-bold text-[#1462C4]">Preparation &amp; Inspections</Link>.</p>}</Card>
      </div>}
      {tab === "history" && <Card title="History" description="Who changed what, newest first."><HistoryList entries={detail.history} /></Card>}
    </div>
    {!detail.schemaReady && <div className="mt-4"><Notice>Some sections need the database update before they can be used.</Notice></div>}
  </>;
}

function ReadOnly() {
  return <p className="flex items-center gap-2 rounded-xl bg-[#F4F7FA] p-4 text-sm text-[#586575]"><Lock size={16} aria-hidden="true" />Your role can view this vehicle but not change this section.</p>;
}

const actionLabels: Record<string, string> = {
  create: "Created the vehicle", publish: "Published the listing", mark_sold: "Marked as sold", status_change: "Changed status", update_listing: "Updated the listing", price_change: "Changed the price",
  update_disclosures: "Updated condition and disclosures", update_internal: "Updated the internal record", cost_added: "Added a cost", cost_updated: "Updated a cost", cost_removed: "Removed a cost",
  photo_uploaded: "Uploaded a photo", photo_updated: "Changed a photo description", photo_reordered: "Reordered photos", photo_cover: "Changed the cover photo", photo_deleted: "Deleted a photo",
  document_uploaded: "Uploaded a document", document_deleted: "Deleted a document", update: "Updated the vehicle", upload: "Uploaded a photo", delete: "Deleted a photo", reserved: "Reserved", sale_completed: "Completed the sale", sale_cancelled: "Cancelled the reservation",
  created_from_purchase: "Created from a purchased vehicle", prep_item_added: "Added a preparation item", prep_item_updated: "Updated a preparation item", inspection_recorded: "Recorded an inspection",
};

function describe(entry: HistoryEntry) {
  const detail = entry.detail;
  const parts: string[] = [];
  if (typeof detail.from === "string" && typeof detail.to === "string") parts.push(`${stockStatusLabels[detail.from as keyof typeof stockStatusLabels] || detail.from} → ${stockStatusLabels[detail.to as keyof typeof stockStatusLabels] || detail.to}`);
  if (typeof detail.previousPrice === "number" && typeof detail.price === "number") parts.push(`${formatPounds(detail.previousPrice)} → ${formatPounds(detail.price)}`);
  if (Array.isArray(detail.changed) && detail.changed.length) parts.push(`Fields: ${detail.changed.join(", ").replaceAll("_", " ")}`);
  if (typeof detail.reason === "string") parts.push(`Note: ${detail.reason}`);
  return parts.join(" · ");
}

function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return <p className="flex items-center gap-2 text-sm text-[#586575]"><History size={16} aria-hidden="true" />No changes recorded yet.</p>;
  return <ol className="grid gap-0">{entries.map((entry) => <li key={entry.id} className="grid gap-0.5 border-l-2 border-[#D7E0E9] py-2 pl-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
    <time dateTime={entry.createdAt} className="text-xs font-bold text-[#586575]">{formatDateTime(entry.createdAt)}</time>
    <div><p className="text-sm font-bold text-[#071127]">{actionLabels[entry.action] || entry.action.replaceAll("_", " ")} <span className="font-semibold text-[#586575]">by {entry.actorName}</span></p>{describe(entry) && <p className="text-xs text-[#586575]">{describe(entry)}</p>}</div>
  </li>)}</ol>;
}
