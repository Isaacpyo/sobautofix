import { ArrowLeftRight, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPagination } from "@/components/admin/admin-list-controls";
import { formatDate, submissionStatusLabels, submissionStatusTones, submissionStatuses } from "@/components/admin/exchange/labels";
import { ExchangeListFilters, FilterChips } from "@/components/admin/exchange/list-filters";
import { Badge, EmptyState, LinkButton, NoAccess, PageHeading } from "@/components/admin/exchange/ui";
import { listSubmissions, submissionIdForEnquiry } from "@/lib/exchange/admin/buying";
import { listStaff } from "@/lib/exchange/admin/core";
import { formatPence } from "@/lib/exchange/margin";
import { requireStaffPage } from "@/lib/exchange/staff";
import { formatRegistration } from "@/lib/vehicle/registration-format";

const pageSize = 20;

export default async function BuyingEnquiriesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; kind?: string; assigned?: string; page?: string; enquiry?: string }> }) {
  const { staff, allowed } = await requireStaffPage("buying.manage");
  if (!allowed) return <NoAccess area="buying enquiries" />;
  const params = await searchParams;
  if (params.enquiry) {
    const id = await submissionIdForEnquiry(staff.client, params.enquiry);
    if (id) redirect(`/admin/exchange/buying/${id}`);
  }
  const query = (params.q || "").trim();
  const status = params.status === "open" || submissionStatuses.includes(params.status as never) ? params.status! : "";
  const kind = params.kind === "sell" || params.kind === "part_exchange" ? params.kind : "";
  const assigned = params.assigned || "";
  const [all, staffList] = await Promise.all([listSubmissions(staff, { q: query, kind, assigned }), listStaff(staff.client)]);
  const names = new Map(staffList.map((member) => [member.id, member.name]));
  const filtered = status === "open" ? all.filter((item) => ["new", "reviewing", "provisional_offer", "inspection", "final_offer"].includes(item.status)) : status ? all.filter((item) => item.status === status) : all;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(params.page || "1", 10) || 1), totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const keep = { q: query, kind, assigned };

  return <>
    <PageHeading eyebrow="Buying" title="Buying Enquiries" description="Sell-your-car and part-exchange submissions, from first look to purchase. Offers are recorded here; tell the seller through the conversation." actions={<LinkButton href="/admin/exchange/enquiries/new?type=buying" variant="primary"><Plus size={17} aria-hidden="true" />New buying enquiry</LinkButton>} />
    <ExchangeListFilters action="/admin/exchange/buying" query={query} placeholder="Reference, vehicle, registration or customer…" selects={[
      { name: "status", label: "Stage", value: status, allLabel: "All stages", options: [{ value: "open", label: "Open (not finished)" }, ...submissionStatuses.map((value) => ({ value, label: submissionStatusLabels[value] }))] },
      { name: "kind", label: "Type", value: kind, allLabel: "Sell and part exchange", options: [{ value: "sell", label: "Sell my car" }, { value: "part_exchange", label: "Part exchange" }] },
      { name: "assigned", label: "Assigned", value: assigned, allLabel: "Anyone", options: [{ value: "me", label: "Assigned to me" }, { value: "none", label: "Unassigned" }, ...staffList.map((member) => ({ value: member.id, label: member.name }))] },
    ]} />
    <FilterChips action="/admin/exchange/buying" param="status" value={status} keep={keep} options={[{ value: "", label: "All", count: all.length }, ...submissionStatuses.map((value) => ({ value, label: submissionStatusLabels[value], count: all.filter((item) => item.status === value).length }))]} />

    {!visible.length ? <div className="mt-4"><EmptyState icon={Inbox} title={all.length ? "No enquiries match these filters" : "No buying enquiries yet"}>{all.length ? "Try a different search or clear the filters." : "Submissions from the Sell your car page appear here."}</EmptyState></div> : <>
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-[#E4EAF0] bg-white lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Buying enquiries</caption>
          <thead className="bg-[#F4F7FA] text-xs font-extrabold tracking-wide text-[#586575] uppercase"><tr><th scope="col" className="px-4 py-3">Vehicle</th><th scope="col" className="px-4 py-3">Seller</th><th scope="col" className="px-4 py-3">Stage</th><th scope="col" className="px-4 py-3">Offer</th><th scope="col" className="px-4 py-3">Assigned</th><th scope="col" className="px-4 py-3">Received</th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id} className="border-t border-[#E4EAF0] align-top hover:bg-[#F8FAFC]">
            <td className="px-4 py-3"><Link href={`/admin/exchange/buying/${item.id}`} className="font-extrabold text-[#071127] hover:text-[#1462C4]">{item.vehicle}</Link><p className="text-xs font-bold text-[#586575]">{item.reference}{item.registration ? ` · ${formatRegistration(item.registration)}` : ""}{item.mileage != null ? ` · ${item.mileage.toLocaleString("en-GB")} miles` : ""}</p>{item.kind === "part_exchange" && <p className="mt-1"><Badge tone="info"><ArrowLeftRight size={12} aria-hidden="true" />Part exchange{item.interestedVehicle ? ` for ${item.interestedVehicle.title}` : ""}</Badge></p>}</td>
            <td className="px-4 py-3 text-[#344054]">{item.customerName || "Customer"}{item.notificationStatus === "failed" && <p className="text-xs font-bold text-[#B42318]">Notification failed</p>}</td>
            <td className="px-4 py-3"><Badge tone={submissionStatusTones[item.status]}>{submissionStatusLabels[item.status]}</Badge></td>
            <td className="px-4 py-3">{item.offerPence != null ? <><span className="font-extrabold text-[#071127]">{formatPence(item.offerPence)}</span>{item.offerExpiresOn && <p className="text-xs text-[#586575]">Until {formatDate(item.offerExpiresOn)}</p>}</> : <span className="text-[#667586]">None yet</span>}</td>
            <td className="px-4 py-3 text-[#344054]">{item.assignedTo ? names.get(item.assignedTo) || "Staff" : <span className="text-[#667586]">Unassigned</span>}</td>
            <td className="px-4 py-3 text-[#586575]">{formatDate(item.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="mt-4 grid gap-3 lg:hidden">{visible.map((item) => <li key={item.id}><Link href={`/admin/exchange/buying/${item.id}`} className="block rounded-xl border border-[#E4EAF0] bg-white p-4">
        <div className="flex items-start justify-between gap-2"><p className="font-extrabold text-[#071127]">{item.vehicle}</p><Badge tone={submissionStatusTones[item.status]}>{submissionStatusLabels[item.status]}</Badge></div>
        <p className="mt-0.5 text-xs font-bold text-[#586575]">{item.reference} · {item.customerName || "Customer"}</p>
        {item.kind === "part_exchange" && <p className="mt-2"><Badge tone="info"><ArrowLeftRight size={12} aria-hidden="true" />Part exchange{item.interestedVehicle ? ` for ${item.interestedVehicle.title}` : ""}</Badge></p>}
        <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-[#EEF2F6] pt-2 text-xs text-[#586575]"><span>{item.offerPence != null ? `Offer ${formatPence(item.offerPence)}` : "No offer yet"}</span><span>{item.assignedTo ? names.get(item.assignedTo) || "Staff" : "Unassigned"} · {formatDate(item.createdAt)}</span></div>
      </Link></li>)}</ul>
      <AdminPagination path="/admin/exchange/buying" page={page} pageSize={pageSize} totalItems={filtered.length} query={query} status={status} additionalParams={{ kind, assigned }} />
    </>}
  </>;
}
