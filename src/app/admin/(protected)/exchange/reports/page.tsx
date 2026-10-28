import { Download, Info } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/components/admin/exchange/labels";
import { FilterChips } from "@/components/admin/exchange/list-filters";
import { Badge, Card, NoAccess, PageHeading, StatTile } from "@/components/admin/exchange/ui";
import { loadReport, reportPeriod } from "@/lib/exchange/admin/reports";
import { formatPence, REPORT_DEFINITIONS } from "@/lib/exchange/margin";
import { requireStaffPage } from "@/lib/exchange/staff";
import { cn } from "@/lib/utils";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { staff, allowed } = await requireStaffPage("finance.view");
  if (!allowed) return <NoAccess area="costs and reporting" />;
  const period = reportPeriod((await searchParams).period);
  const { rows, summary, funnel } = await loadReport(staff, period);
  const funnelSteps = [
    { label: "Viewing requests", value: funnel.viewingRequests },
    { label: "Sales enquiries", value: funnel.salesEnquiries },
    { label: "Seller submissions", value: funnel.sellerSubmissions },
    { label: "Qualified seller enquiries", value: funnel.qualifiedSellerEnquiries, note: "Reached a provisional offer or beyond" },
    { label: "Offers accepted", value: funnel.offersAccepted },
    { label: "Purchased", value: funnel.purchased },
    { label: "Sold", value: funnel.sold },
  ];
  const max = Math.max(1, ...funnelSteps.map((step) => step.value));

  return <>
    <PageHeading eyebrow="Finance" title="Costs & Reporting" description="Recorded figures for owners and managers. Every amount is a recorded cost or price; nothing here is net profit." actions={<a href={`/api/admin/exchange/reports/export?period=${period.key}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C9D5E2] bg-white px-4 text-sm font-extrabold text-[#071127] hover:border-[#1974E2]"><Download size={16} aria-hidden="true" />Export CSV</a>} />
    <FilterChips action="/admin/exchange/reports" param="period" value={period.key} options={[{ value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "year", label: "This year" }, { value: "all", label: "All time" }]} />
    <p className="mt-2 text-sm text-[#586575]">{period.label}: {formatDate(period.from)} to {formatDate(period.to)}</p>

    <section aria-label="Period totals" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile label="Vehicles sold" value={summary.soldCount} support="Completed in the period" />
      <StatTile label="Sales" value={formatPence(summary.salesPence)} support="Completed sale prices" />
      <StatTile label="Direct costs" value={formatPence(summary.costsPence)} support="Of vehicles sold" />
      <StatTile label="Recorded gross margin" value={formatPence(summary.grossMarginPence)} support={summary.soldCount ? (summary.allActual ? "Actual" : "Includes estimates") : "No sales yet"} tone={summary.grossMarginPence < 0 ? "warning" : "default"} />
      <StatTile label="Average days in stock" value={summary.averageDaysInStock ?? "None"} support={`${summary.inStockCount} in stock, ${formatPence(summary.stockCostsPence)} costs`} />
    </section>

    <Card className="mt-4" title="Funnel" description="Enquiries received in the period and what came of them. Sold counts sales completed in the period.">
      <ol className="grid gap-2">{funnelSteps.map((step) => <li key={step.label} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
        <span className="font-bold text-[#344054]">{step.label}{step.note && <span className="block text-xs font-normal text-[#586575]">{step.note}</span>}</span>
        <span className="h-3 overflow-hidden rounded-full bg-[#EEF2F6]" aria-hidden="true"><span className="block h-full rounded-full bg-[#1974E2]" style={{ width: `${(step.value / max) * 100}%` }} /></span>
        <span className="text-right font-extrabold text-[#071127]">{step.value}</span>
      </li>)}</ol>
    </Card>

    <Card className="mt-4" title="By vehicle" description="Everything in stock, plus vehicles sold in the period. Estimated figures use the advertised price or include estimated costs.">
      {rows.length ? <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <caption className="sr-only">Costs and recorded gross margin by vehicle</caption>
          <thead className="text-xs font-extrabold tracking-wide text-[#586575] uppercase"><tr>
            <th scope="col" className="py-2 pr-3">Vehicle</th><th scope="col" className="py-2 pr-3 text-right">Acquisition</th><th scope="col" className="py-2 pr-3 text-right">Transport</th><th scope="col" className="py-2 pr-3 text-right">Prep &amp; repair</th><th scope="col" className="py-2 pr-3 text-right">Other</th><th scope="col" className="py-2 pr-3 text-right">Sale price</th><th scope="col" className="py-2 pr-3 text-right">Gross margin</th><th scope="col" className="py-2 pr-3 text-right">Days</th>
          </tr></thead>
          <tbody>{rows.map((row) => <tr key={row.vehicleId} className="border-t border-[#EEF2F6] align-top">
            <td className="py-2 pr-3"><Link href={`/admin/exchange/stock/${row.vehicleId}?tab=costs`} className="font-bold text-[#071127] hover:text-[#1462C4]">{row.vehicle}</Link><p className="text-xs text-[#586575]">{row.stockReference} · {row.status}</p></td>
            <td className={cn("py-2 pr-3 text-right", !row.hasAcquisitionCost && "text-[#B54708]")}>{row.hasAcquisitionCost ? formatPence(row.acquisitionPence) : "Not recorded"}</td>
            <td className="py-2 pr-3 text-right">{formatPence(row.transportPence)}</td>
            <td className="py-2 pr-3 text-right">{formatPence(row.preparationRepairPence)}</td>
            <td className="py-2 pr-3 text-right">{formatPence(row.otherDirectPence)}</td>
            <td className="py-2 pr-3 text-right">{formatPence(row.salePricePence)}<p className="text-xs text-[#586575]">{row.salePriceBasis === "actual" ? "Sold" : "Advertised"}</p></td>
            <td className={cn("py-2 pr-3 text-right font-extrabold", row.grossMarginPence < 0 ? "text-[#B42318]" : "text-[#071127]")}>{formatPence(row.grossMarginPence)}<p className="mt-0.5"><Badge tone={row.marginBasis === "actual" ? "success" : "warning"}>{row.marginBasis === "actual" ? "Actual" : "Estimated"}</Badge></p></td>
            <td className="py-2 pr-3 text-right">{row.daysInStock}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="text-sm text-[#586575]">No vehicles to report.</p>}
    </Card>

    <Card className="mt-4" title={<span className="flex items-center gap-2"><Info size={17} aria-hidden="true" />How these figures are worked out</span>}>
      <dl className="grid gap-3 sm:grid-cols-2">{REPORT_DEFINITIONS.map((item) => <div key={item.term}><dt className="text-sm font-extrabold text-[#071127]">{item.term}</dt><dd className="text-sm leading-6 text-[#586575]">{item.definition}</dd></div>)}</dl>
      <p className="mt-3 text-xs text-[#586575]">All amounts are stored in whole pence. The CSV export contains vehicle and money columns only: no customer details and no registrations.</p>
    </Card>
  </>;
}
