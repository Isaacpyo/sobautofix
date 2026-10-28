import { CarFront, Plus } from "lucide-react";
import { AdminBulkActions, AdminItemCheckbox } from "@/components/admin/admin-bulk-actions";
import { AdminLoadingLink } from "@/components/admin/admin-loading-link";
import { AdminPagination } from "@/components/admin/admin-list-controls";
import { formatPounds, stockStatusLabels, stockStatusOrder, vehicleTitle } from "@/components/admin/exchange/labels";
import { ExchangeListFilters, FilterChips } from "@/components/admin/exchange/list-filters";
import { ReadinessBadge, StockStatusBadge } from "@/components/admin/exchange/stock-badges";
import { StockSoldToggle } from "@/components/admin/exchange/stock-status-controls";
import { EmptyState, LinkButton, NoAccess, PageHeading, Thumb } from "@/components/admin/exchange/ui";
import { listStock, stockSorts } from "@/lib/exchange/admin/stock";
import { requireStaffPage } from "@/lib/exchange/staff";
import { manageTrashAction } from "../../trash/actions";
import { formatRegistration } from "@/lib/vehicle/registration-format";

const pageSize = 20;

export default async function ExchangeStockPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }> }) {
  const { staff, allowed } = await requireStaffPage("exchange.view");
  if (!allowed) return <NoAccess area="Vehicle Stock" />;
  const params = await searchParams;
  const query = (params.q || "").trim();
  const status = stockStatusOrder.includes(params.status as never) ? params.status! : "";
  const sort = stockSorts.some((option) => option.value === params.sort) ? params.sort! : "updated";
  const all = await listStock(staff.client, { q: query, sort });
  const counts = Object.fromEntries(stockStatusOrder.map((value) => [value, all.filter((item) => item.vehicle.status === value).length]));
  const filtered = status ? all.filter((item) => item.vehicle.status === status) : all;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(params.page || "1", 10) || 1), totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const canPublish = staff.can("stock.publish");
  const keep = { q: query, sort: sort === "updated" ? "" : sort };

  return <>
    <PageHeading eyebrow="Stock" title="Vehicle Stock" description="Every vehicle from draft to sold. Publishing needs the checklist complete; reservations and completed sales are recorded in Sales & Handover." actions={staff.can("stock.edit") ? <LinkButton href="/admin/exchange/stock/new" variant="primary"><Plus size={17} aria-hidden="true" />Add vehicle</LinkButton> : undefined} />
    <ExchangeListFilters action="/admin/exchange/stock" query={query} placeholder="Make, model, registration or stock ref…" selects={[
      { name: "status", label: "Status", value: status, allLabel: "All statuses", options: stockStatusOrder.map((value) => ({ value, label: stockStatusLabels[value] })) },
      { name: "sort", label: "Sort", value: sort, options: stockSorts },
    ]} />
    <FilterChips action="/admin/exchange/stock" param="status" value={status} keep={keep} options={[{ value: "", label: "All", count: all.length }, ...stockStatusOrder.map((value) => ({ value, label: stockStatusLabels[value], count: counts[value] }))]} />

    {!visible.length ? <div className="mt-4"><EmptyState icon={CarFront} title={all.length ? "No vehicles match these filters" : "No vehicles in stock yet"} action={staff.can("stock.edit") && !all.length ? <LinkButton href="/admin/exchange/stock/new" variant="primary"><Plus size={17} aria-hidden="true" />Add the first vehicle</LinkButton> : undefined}>{all.length ? "Try a different search or clear the filters." : "Add a vehicle by registration to create a draft listing."}</EmptyState></div> : <BulkWrap enabled={canPublish}>
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-[#E4EAF0] bg-white lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Vehicle stock</caption>
          <thead className="bg-[#F4F7FA] text-xs font-extrabold tracking-wide text-[#586575] uppercase"><tr>{canPublish && <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Select</span></th>}<th scope="col" className="px-4 py-3">Vehicle</th><th scope="col" className="px-4 py-3">Price</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">In stock</th><th scope="col" className="px-4 py-3">Publishing</th><th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{visible.map(({ vehicle, daysInStock, readiness, hasActiveSale }) => <tr key={vehicle.id} className="border-t border-[#E4EAF0] align-middle hover:bg-[#F8FAFC]">
            {canPublish && <td className="px-2 py-3"><AdminItemCheckbox id={vehicle.id} label={`Select ${vehicleTitle(vehicle)}`} /></td>}
            <td className="px-4 py-3"><div className="flex items-center gap-3"><Thumb url={vehicle.images[0]?.url} alt="" className="w-20" /><div className="min-w-0"><a href={`/admin/exchange/stock/${vehicle.id}`} className="font-extrabold text-[#071127] hover:text-[#1462C4]">{vehicleTitle(vehicle)}</a><p className="truncate text-xs text-[#667586]">{vehicle.derivative || "No derivative"}</p><p className="mt-0.5 text-xs font-bold text-[#586575]">{vehicle.stockReference || "No stock ref"}{vehicle.registration ? ` · ${formatRegistration(vehicle.registration)}` : ""}</p></div></div></td>
            <td className="px-4 py-3 font-extrabold text-[#071127]">{vehicle.price > 0 ? formatPounds(vehicle.price) : <span className="text-[#B42318]">Not priced</span>}</td>
            <td className="px-4 py-3"><StockStatusBadge status={vehicle.status} /></td>
            <td className="px-4 py-3 text-[#344054]">{daysInStock} {daysInStock === 1 ? "day" : "days"}</td>
            <td className="px-4 py-3"><ReadinessBadge readiness={readiness} status={vehicle.status} /></td>
            <td className="px-4 py-3"><div className="flex items-center justify-end gap-2">{canPublish && <StockSoldToggle vehicle={{ id: vehicle.id, status: vehicle.status, name: vehicleTitle(vehicle), updatedAt: vehicle.updatedAt }} hasActiveSale={hasActiveSale} compact />}<AdminLoadingLink href={`/admin/exchange/stock/${vehicle.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-[#BCD6F6] px-3 text-xs font-extrabold text-[#1446A5] hover:bg-[#F1F7FF]" loadingTitle="Opening vehicle" loadingDescription="Please wait while the vehicle record opens.">Open<span className="sr-only"> {vehicleTitle(vehicle)}</span></AdminLoadingLink></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="mt-4 grid gap-3 lg:hidden">{visible.map(({ vehicle, daysInStock, readiness, hasActiveSale }) => <li key={vehicle.id} className="rounded-xl border border-[#E4EAF0] bg-white p-3">
        <a href={`/admin/exchange/stock/${vehicle.id}`} className="flex gap-3">
          <Thumb url={vehicle.images[0]?.url} alt="" className="w-24" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2"><p className="font-extrabold leading-5 text-[#071127]">{vehicleTitle(vehicle)}</p><StockStatusBadge status={vehicle.status} /></div>
            <p className="mt-0.5 truncate text-xs text-[#667586]">{vehicle.stockReference || "No stock ref"}{vehicle.registration ? ` · ${formatRegistration(vehicle.registration)}` : ""}</p>
            <p className="mt-1 text-lg font-extrabold text-[#071127]">{vehicle.price > 0 ? formatPounds(vehicle.price) : <span className="text-sm text-[#B42318]">Not priced</span>}</p>
          </div>
        </a>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F6] pt-2"><span className="text-xs font-semibold text-[#586575]">{daysInStock} {daysInStock === 1 ? "day" : "days"} in stock</span><ReadinessBadge readiness={readiness} status={vehicle.status} /></div>
        {canPublish && (vehicle.status === "available" || vehicle.status === "sold") && <div className="mt-2"><StockSoldToggle vehicle={{ id: vehicle.id, status: vehicle.status, name: vehicleTitle(vehicle), updatedAt: vehicle.updatedAt }} hasActiveSale={hasActiveSale} /></div>}
      </li>)}</ul>
      <AdminPagination path="/admin/exchange/stock" page={page} pageSize={pageSize} totalItems={filtered.length} query={query} status={status} additionalParams={{ sort: sort === "updated" ? "" : sort }} />
    </BulkWrap>}
  </>;
}

/** Bulk "Move to trash" (the existing CMS trash) for staff who may withdraw stock. */
function BulkWrap({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return enabled ? <AdminBulkActions entity="inventory" action={manageTrashAction}>{children}</AdminBulkActions> : <>{children}</>;
}
