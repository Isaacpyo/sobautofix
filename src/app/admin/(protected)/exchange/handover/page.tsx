import { ArrowLeftRight, Handshake } from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime, handoverMethodLabels, label, paymentStatusLabels, vehicleSaleStatusLabels, vehicleSaleStatuses, vehicleSaleStatusTones } from "@/components/admin/exchange/labels";
import { ExchangeListFilters, FilterChips } from "@/components/admin/exchange/list-filters";
import { ReserveForm } from "@/components/admin/exchange/reserve-form";
import { Badge, Card, EmptyState, NoAccess, PageHeading } from "@/components/admin/exchange/ui";
import { listSales } from "@/lib/exchange/admin/handover";
import { loadStockVehicle } from "@/lib/exchange/admin/stock";
import { formatPence } from "@/lib/exchange/margin";
import { requireStaffPage } from "@/lib/exchange/staff";

export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; reserve?: string }> }) {
  const { staff, allowed } = await requireStaffPage("sales.manage");
  if (!allowed) return <NoAccess area="sales and handover" />;
  const params = await searchParams;
  const query = (params.q || "").trim();
  const status = params.status === "active" || params.status === "all" || vehicleSaleStatuses.includes(params.status as never) ? params.status! : "active";
  const [all, reserveTarget] = await Promise.all([listSales(staff, { q: query }), params.reserve ? loadStockVehicle(staff.client, params.reserve) : Promise.resolve(null)]);
  const visible = status === "all" ? all : status === "active" ? all.filter((item) => ["reserved", "awaiting_payment", "ready_for_handover"].includes(item.status)) : all.filter((item) => item.status === status);
  const now = Date.now();

  return <>
    <PageHeading eyebrow="Selling" title="Sales & Handover" description="Reservations through to handover. Payments are recorded here only; nothing is charged online. Completing a sale marks the vehicle Sold on the website." />
    {reserveTarget && <Card className="mt-4 border-[#B9D8FF]" title={`Reserve the ${reserveTarget.vehicle.year} ${reserveTarget.vehicle.make} ${reserveTarget.vehicle.model}`} description="A reservation without a sales enquiry, for example a walk-in buyer. Use the sales enquiry instead when there is one, so the conversation stays linked.">
      {reserveTarget.vehicle.status === "available" ? <ReserveForm vehicle={{ id: reserveTarget.vehicle.id, title: `${reserveTarget.vehicle.year} ${reserveTarget.vehicle.make} ${reserveTarget.vehicle.model}`, price: reserveTarget.vehicle.price }} canChangePrice={staff.can("stock.price")} /> : <p className="text-sm text-[#586575]">This vehicle is not available to reserve.</p>}
    </Card>}
    <ExchangeListFilters action="/admin/exchange/handover" query={query} placeholder="Vehicle, stock ref or customer…" selects={[{ name: "status", label: "Stage", value: status, options: [{ value: "active", label: "In progress" }, { value: "all", label: "All" }, ...vehicleSaleStatuses.map((value) => ({ value, label: vehicleSaleStatusLabels[value] }))] }]} />
    <FilterChips action="/admin/exchange/handover" param="status" value={status} keep={{ q: query }} options={[{ value: "active", label: "In progress", count: all.filter((item) => ["reserved", "awaiting_payment", "ready_for_handover"].includes(item.status)).length }, ...vehicleSaleStatuses.map((value) => ({ value, label: vehicleSaleStatusLabels[value], count: all.filter((item) => item.status === value).length })), { value: "all", label: "All", count: all.length }]} />
    {!visible.length ? <div className="mt-4"><EmptyState icon={Handshake} title="Nothing here">Reserve a vehicle from its sales enquiry to start a sale.</EmptyState></div> : <ul className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{visible.map((item) => {
      const expired = item.reservationExpiresAt && new Date(item.reservationExpiresAt).getTime() < now && ["reserved", "awaiting_payment"].includes(item.status);
      return <li key={item.id}><Link href={`/admin/exchange/handover/${item.id}`} className="block h-full rounded-xl border border-[#E4EAF0] bg-white p-4 transition hover:border-[#1974E2]">
        <div className="flex items-start justify-between gap-2"><p className="font-extrabold text-[#071127]">{item.vehicle?.title || "Vehicle"}</p><Badge tone={vehicleSaleStatusTones[item.status]}>{vehicleSaleStatusLabels[item.status]}</Badge></div>
        <p className="text-xs font-bold text-[#586575]">{item.vehicle?.stockReference}{item.customerName ? ` · ${item.customerName}` : ""}</p>
        {item.partExchange && <p className="mt-2"><Badge tone="info"><ArrowLeftRight size={12} aria-hidden="true" />Part exchange</Badge></p>}
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#EEF2F6] pt-3 text-sm">
          <div><dt className="text-xs text-[#586575]">Agreed</dt><dd className="font-extrabold text-[#071127]">{formatPence(item.agreedPricePence)}</dd></div>
          <div><dt className="text-xs text-[#586575]">Payment</dt><dd className="font-bold text-[#344054]">{label(paymentStatusLabels, item.paymentStatus)}</dd></div>
          <div><dt className="text-xs text-[#586575]">{item.status === "completed" ? "Completed" : "Reservation ends"}</dt><dd className={expired ? "font-bold text-[#B42318]" : "text-[#344054]"}>{item.status === "completed" ? formatDate(item.completedAt) : item.reservationExpiresAt ? `${formatDateTime(item.reservationExpiresAt)}${expired ? " (passed)" : ""}` : "No end date"}</dd></div>
          <div><dt className="text-xs text-[#586575]">Handover</dt><dd className="text-[#344054]">{label(handoverMethodLabels, item.handoverMethod)}{item.handoverAt ? `, ${formatDate(item.handoverAt)}` : ""}</dd></div>
        </dl>
      </Link></li>;
    })}</ul>}
  </>;
}
