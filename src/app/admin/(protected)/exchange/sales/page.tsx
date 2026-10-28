import { AlarmClock, ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { AdminPagination } from "@/components/admin/admin-list-controls";
import { formatDate, formatDateTime, salesStageLabels, salesStageTones, salesStages } from "@/components/admin/exchange/labels";
import { ExchangeListFilters, FilterChips } from "@/components/admin/exchange/list-filters";
import { Badge, EmptyState, LinkButton, NoAccess, PageHeading } from "@/components/admin/exchange/ui";
import { listStaff } from "@/lib/exchange/admin/core";
import { listSalesEnquiries } from "@/lib/exchange/admin/sales";
import { requireStaffPage } from "@/lib/exchange/staff";

const pageSize = 20;

export default async function SalesEnquiriesPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string; assigned?: string; followUp?: string; page?: string }> }) {
  const { staff, allowed } = await requireStaffPage("sales.manage");
  if (!allowed) return <NoAccess area="sales enquiries" />;
  const params = await searchParams;
  const query = (params.q || "").trim();
  const stage = params.stage === "open" || salesStages.includes(params.stage as never) ? params.stage! : "";
  const assigned = params.assigned || "";
  const followUp = params.followUp === "overdue" ? "overdue" : "";
  const [all, staffList] = await Promise.all([listSalesEnquiries(staff, { q: query, assigned, followUp }), listStaff(staff.client)]);
  const names = new Map(staffList.map((member) => [member.id, member.name]));
  const filtered = stage === "open" ? all.filter((item) => item.stage !== "sold" && item.stage !== "lost") : stage ? all.filter((item) => item.stage === stage) : all;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(params.page || "1", 10) || 1), totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <>
    <PageHeading eyebrow="Selling" title="Sales Enquiries" description="Buyers asking about stock or requesting viewings. Reply from the conversation; reserve a vehicle once a price and deposit are agreed." actions={<LinkButton href="/admin/exchange/enquiries/new?type=sales" variant="primary"><Plus size={17} aria-hidden="true" />New sales enquiry</LinkButton>} />
    <ExchangeListFilters action="/admin/exchange/sales" query={query} placeholder="Customer or vehicle…" selects={[
      { name: "stage", label: "Stage", value: stage, allLabel: "All stages", options: [{ value: "open", label: "Open (not sold or lost)" }, ...salesStages.map((value) => ({ value, label: salesStageLabels[value] }))] },
      { name: "assigned", label: "Assigned", value: assigned, allLabel: "Anyone", options: [{ value: "me", label: "Assigned to me" }, { value: "none", label: "Unassigned" }, ...staffList.map((member) => ({ value: member.id, label: member.name }))] },
      { name: "followUp", label: "Follow-up", value: followUp, allLabel: "Any", options: [{ value: "overdue", label: "Overdue" }] },
    ]} />
    <FilterChips action="/admin/exchange/sales" param="stage" value={stage} keep={{ q: query, assigned, followUp }} options={[{ value: "", label: "All", count: all.length }, ...salesStages.map((value) => ({ value, label: salesStageLabels[value], count: all.filter((item) => item.stage === value).length }))]} />
    {!visible.length ? <div className="mt-4"><EmptyState icon={ClipboardList} title={all.length ? "No enquiries match these filters" : "No sales enquiries yet"}>{all.length ? "Try a different search or clear the filters." : "Questions and viewing requests from vehicle pages appear here."}</EmptyState></div> : <>
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-[#E4EAF0] bg-white lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Sales enquiries</caption>
          <thead className="bg-[#F4F7FA] text-xs font-extrabold tracking-wide text-[#586575] uppercase"><tr><th scope="col" className="px-4 py-3">Customer</th><th scope="col" className="px-4 py-3">Vehicle</th><th scope="col" className="px-4 py-3">Stage</th><th scope="col" className="px-4 py-3">Assigned</th><th scope="col" className="px-4 py-3">Follow-up</th><th scope="col" className="px-4 py-3">Received</th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id} className="border-t border-[#E4EAF0] align-top hover:bg-[#F8FAFC]">
            <td className="px-4 py-3"><Link href={`/admin/exchange/sales/${item.id}`} className="font-extrabold text-[#071127] hover:text-[#1462C4]">{item.customerName || "Customer"}</Link>{item.source === "staff" && <p className="text-xs text-[#586575]">Added by staff</p>}{item.notificationStatus === "failed" && <p className="text-xs font-bold text-[#B42318]">Notification failed</p>}</td>
            <td className="px-4 py-3">{item.vehicle ? <><Link href={`/admin/exchange/stock/${item.vehicle.id}`} className="font-bold text-[#344054] hover:text-[#1462C4]">{item.vehicle.title}</Link><p className="text-xs capitalize text-[#586575]">{item.vehicle.status === "archived" ? "Withdrawn" : item.vehicle.status}</p></> : <span className="text-[#667586]">No vehicle linked</span>}</td>
            <td className="px-4 py-3"><Badge tone={salesStageTones[item.stage]}>{salesStageLabels[item.stage]}</Badge></td>
            <td className="px-4 py-3 text-[#344054]">{item.assignedTo ? names.get(item.assignedTo) || "Staff" : <span className="text-[#667586]">Unassigned</span>}</td>
            <td className="px-4 py-3">{item.followUpAt ? <span className={item.overdue ? "inline-flex items-center gap-1 font-bold text-[#B42318]" : "text-[#344054]"}>{item.overdue && <AlarmClock size={14} aria-hidden="true" />}{formatDateTime(item.followUpAt)}{item.overdue && <span className="sr-only"> (overdue)</span>}</span> : <span className="text-[#667586]">None</span>}</td>
            <td className="px-4 py-3 text-[#586575]">{formatDate(item.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="mt-4 grid gap-3 lg:hidden">{visible.map((item) => <li key={item.id}><Link href={`/admin/exchange/sales/${item.id}`} className="block rounded-xl border border-[#E4EAF0] bg-white p-4">
        <div className="flex items-start justify-between gap-2"><p className="font-extrabold text-[#071127]">{item.customerName || "Customer"}</p><Badge tone={salesStageTones[item.stage]}>{salesStageLabels[item.stage]}</Badge></div>
        <p className="mt-0.5 text-sm text-[#344054]">{item.vehicle?.title || "No vehicle linked"}</p>
        <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-[#EEF2F6] pt-2 text-xs text-[#586575]"><span className={item.overdue ? "font-bold text-[#B42318]" : ""}>{item.followUpAt ? `Follow up ${formatDateTime(item.followUpAt)}` : "No follow-up"}</span><span>{item.assignedTo ? names.get(item.assignedTo) || "Staff" : "Unassigned"}</span></div>
      </Link></li>)}</ul>
      <AdminPagination path="/admin/exchange/sales" page={page} pageSize={pageSize} totalItems={filtered.length} query={query} status="" additionalParams={{ stage, assigned, followUp }} />
    </>}
  </>;
}
