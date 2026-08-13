import Link from "next/link";
import { AdminListFilters, AdminPagination } from "@/components/admin/admin-list-controls";
import { resendEnquiryNotifications } from "../actions";
import { createAdminReadClient as createClient } from "@/lib/supabase/server";

type EnquiryRow = {
  id: string; type: string; description: string | null; status: string; notification_status: string; created_at: string;
  customers: { name: string; email: string | null; phone: string } | null;
  vehicles: { registration: string | null; make: string | null; model: string | null } | null;
};
type ConversationRow = { enquiry_id: string; unread_count: number; last_activity_at: string };
type MessageRow = { enquiry_id: string; text_body: string; direction: string; created_at: string };
const pageSize = 20;

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const status = params.status || "";
  const requestedPage = positivePage(params.page);
  const client = await createClient();
  const [enquiriesResult, conversationsResult, messagesResult] = client ? await Promise.all([
    client.from("enquiries").select("id,type,description,status,notification_status,created_at,customers(name,email,phone),vehicles(registration,make,model)").order("created_at", { ascending: false }).limit(250),
    client.from("enquiry_conversations").select("enquiry_id,unread_count,last_activity_at").order("last_activity_at", { ascending: false }).limit(250),
    client.from("enquiry_messages").select("enquiry_id,text_body,direction,created_at").order("created_at", { ascending: false }).limit(1000),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const enquiries = (enquiriesResult.data || []) as unknown as EnquiryRow[];
  const conversations = new Map(((conversationsResult.data || []) as ConversationRow[]).map((item) => [item.enquiry_id, item]));
  const latestMessages = new Map<string, MessageRow>();
  for (const message of (messagesResult.data || []) as MessageRow[]) if (!latestMessages.has(message.enquiry_id)) latestMessages.set(message.enquiry_id, message);
  enquiries.sort((left, right) => (conversations.get(right.id)?.last_activity_at || right.created_at).localeCompare(conversations.get(left.id)?.last_activity_at || left.created_at));
  const filteredEnquiries = enquiries.filter((enquiry) => {
    const conversation = conversations.get(enquiry.id);
    const latest = latestMessages.get(enquiry.id);
    const searchable = [enquiry.type, enquiry.description, enquiry.customers?.name, enquiry.customers?.email, enquiry.customers?.phone, enquiry.vehicles?.registration, enquiry.vehicles?.make, enquiry.vehicles?.model, latest?.text_body].filter(Boolean).join(" ").toLowerCase();
    const matchesStatus = !status || (status === "unread" ? Boolean(conversation?.unread_count) : status === "notification-failed" ? enquiry.notification_status === "failed" : enquiry.status === status);
    return (!query || searchable.includes(query.toLowerCase())) && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredEnquiries.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visibleEnquiries = filteredEnquiries.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Customer requests</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4"><h1 className="text-4xl font-extrabold text-[#071127]">Enquiries</h1><Link href="/admin/enquiries/unmatched" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950">Unmatched inbound</Link></div>
      <p className="mt-2 max-w-2xl text-[#586575]">Open an enquiry to read and continue its email conversation.</p>

      <AdminListFilters action="/admin/enquiries" query={query} status={status} placeholder="Customer, email, phone, vehicle or message…" statusOptions={[{ value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "booked", label: "Booked" }, { value: "closed", label: "Closed" }, { value: "unread", label: "Unread replies" }, { value: "notification-failed", label: "Email failed" }]} />

      <div className="mt-5 hidden max-h-[60vh] overflow-auto rounded-2xl border border-[#E4EAF0] bg-white md:block">
        <table className="w-full table-fixed text-left">
          <thead className="sticky top-0 z-10 bg-[#F4F7FA] text-xs font-extrabold tracking-wide text-[#586575] uppercase shadow-[0_1px_0_#E4EAF0]"><tr><th className="w-[28%] px-5 py-4">Customer</th><th className="w-[30%] px-5 py-4">Enquiry</th><th className="w-[15%] px-5 py-4">Status</th><th className="w-[20%] px-5 py-4">Last activity</th><th className="w-[7%] px-5 py-4"><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{visibleEnquiries.map((enquiry) => {
            const conversation = conversations.get(enquiry.id); const latest = latestMessages.get(enquiry.id);
            return <tr key={enquiry.id} className={`border-t border-[#E4EAF0] ${conversation?.unread_count ? "bg-[#F1F7FF]" : ""}`}>
              <td className="px-5 py-4"><Link href={`/admin/enquiries/${enquiry.id}`} className="font-extrabold text-[#071127] hover:text-[#1974E2]">{conversation?.unread_count ? <span className="mr-2 text-[#1974E2]" aria-label="New customer reply">●</span> : null}{enquiry.customers?.name || "Customer enquiry"}</Link><p className="mt-1 truncate text-xs text-[#667586]">{enquiry.customers?.email || enquiry.customers?.phone}</p></td>
              <td className="px-5 py-4"><p className="font-bold capitalize text-[#071127]">{enquiry.type.replaceAll("_", " ")}</p><p className="mt-1 truncate text-sm text-[#667586]">{latest?.text_body || enquiry.description || "No message preview"}</p>{enquiry.vehicles && <p className="mt-1 truncate text-xs font-semibold text-[#586575]">{[enquiry.vehicles.make, enquiry.vehicles.model, enquiry.vehicles.registration].filter(Boolean).join(" · ")}</p>}</td>
              <td className="px-5 py-4"><Status status={enquiry.status} />{enquiry.notification_status === "failed" && <p className="mt-2 text-xs font-bold text-red-700">Notification failed</p>}</td>
              <td className="px-5 py-4 text-sm text-[#586575]">{formatDate(conversation?.last_activity_at || enquiry.created_at)}{conversation?.unread_count ? <p className="mt-1 text-xs font-bold text-[#1974E2]">New reply</p> : null}</td>
              <td className="px-5 py-4"><Link href={`/admin/enquiries/${enquiry.id}`} aria-label={`Open enquiry from ${enquiry.customers?.name || "customer"}`} className="font-extrabold text-[#1974E2]">Open</Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div>

      <div className="mt-5 grid max-h-[65vh] gap-4 overflow-y-auto pr-1 md:hidden">{visibleEnquiries.map((enquiry) => {
        const conversation = conversations.get(enquiry.id); const latest = latestMessages.get(enquiry.id);
        return <article key={enquiry.id} className={`rounded-2xl border p-5 ${conversation?.unread_count ? "border-[#8EBEF5] bg-[#F1F7FF]" : "border-[#E4EAF0] bg-white"}`}>
          <Link href={`/admin/enquiries/${enquiry.id}`} className="block">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">{enquiry.type.replaceAll("_", " ")}</p><h2 className="mt-2 text-xl font-extrabold text-[#071127]">{enquiry.customers?.name || "Customer enquiry"}</h2></div>{conversation?.unread_count ? <span className="rounded-full bg-[#1974E2] px-2.5 py-1 text-xs font-bold text-white">New reply</span> : <Status status={enquiry.status} />}</div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#586575]">{latest?.text_body || enquiry.description || "No message preview"}</p>
            <p className="mt-3 text-xs text-[#667586]">{formatDate(conversation?.last_activity_at || enquiry.created_at)}</p>
          </Link>
          {enquiry.notification_status === "failed" && <form action={resendEnquiryNotifications} className="mt-4"><input type="hidden" name="id" value={enquiry.id} /><button className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-800">Retry notification email</button></form>}
        </article>;
      })}</div>
      {!visibleEnquiries.length && <p className="mt-5 rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">No enquiries match the current filters.</p>}
      <AdminPagination path="/admin/enquiries" page={page} pageSize={pageSize} totalItems={filteredEnquiries.length} query={query} status={status} />
    </>
  );
}

function Status({ status }: { status: string }) { return <span className="inline-flex rounded-full bg-[#EAF3FF] px-3 py-1 text-xs font-bold capitalize text-[#1446A5]">{status}</span>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
function positivePage(value?: string) { const parsed = Number.parseInt(value || "1", 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : 1; }
