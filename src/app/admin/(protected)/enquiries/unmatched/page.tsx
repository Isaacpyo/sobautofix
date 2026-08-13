import { BackLink } from "@/components/ui/back-link";
import { createAdminReadClient } from "@/lib/supabase/server";
import { ignoreUnmatchedInboundAction, linkUnmatchedInboundAction } from "../../actions";

type UnmatchedRow = { id: string; sender_email: string; subject: string; text_body: string; reason: string; created_at: string };
type EnquiryOption = { id: string; type: string; created_at: string; customers: { name: string } | null };

export default async function UnmatchedInboundPage() {
  const client = await createAdminReadClient();
  const [unmatchedResult, enquiriesResult] = client ? await Promise.all([
    client.from("unmatched_inbound_emails").select("id,sender_email,subject,text_body,reason,created_at").is("linked_enquiry_id", null).is("ignored_at", null).order("created_at", { ascending: false }).limit(100),
    client.from("enquiries").select("id,type,created_at,customers(name)").neq("status", "closed").order("created_at", { ascending: false }).limit(100),
  ]) : [{ data: [] }, { data: [] }];
  const unmatched = (unmatchedResult.data || []) as UnmatchedRow[];
  const enquiries = (enquiriesResult.data || []) as unknown as EnquiryOption[];
  return <>
    <BackLink href="/admin/enquiries">Back to enquiries</BackLink>
    <p className="mt-6 text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Admin attention</p>
    <h1 className="mt-2 text-4xl font-extrabold text-[#071127]">Unmatched inbound email</h1>
    <p className="mt-2 max-w-2xl text-[#586575]">These messages were not linked automatically. Review the content and choose an enquiry only when the relationship is certain.</p>
    <div className="mt-8 grid gap-5">{unmatched.map((message) => <article key={message.id} className="rounded-2xl border border-amber-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="font-extrabold text-[#071127]">{message.sender_email}</p><p className="mt-1 text-sm font-bold text-[#586575]">{message.subject}</p></div><time className="text-xs text-[#667586]">{formatDate(message.created_at)}</time></div>
      <p className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[#F4F7FA] p-4 text-sm leading-6 text-[#263446]">{message.text_body}</p>
      <p className="mt-3 text-xs font-bold text-amber-800">Reason: {message.reason.replaceAll("_", " ")}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {message.reason !== "automated_ignored" && enquiries.length > 0 && <form action={linkUnmatchedInboundAction} className="flex min-w-0 flex-1 flex-wrap items-end gap-3"><input type="hidden" name="unmatchedId" value={message.id} /><label className="grid min-w-64 flex-1 gap-1 text-sm font-bold text-[#071127]">Link to enquiry<select name="enquiryId" required className="min-h-11 rounded-xl border border-[#D7E0E9] bg-white px-3 font-normal"><option value="">Select an enquiry</option>{enquiries.map((enquiry) => <option key={enquiry.id} value={enquiry.id}>{enquiry.customers?.name || "Customer"} · {enquiry.type.replaceAll("_", " ")} · {new Date(enquiry.created_at).toLocaleDateString("en-GB")}</option>)}</select></label><button className="min-h-11 rounded-xl bg-[#071127] px-4 text-sm font-bold text-white">Link message</button></form>}
        <form action={ignoreUnmatchedInboundAction}><input type="hidden" name="unmatchedId" value={message.id} /><button className="min-h-11 rounded-xl border border-[#C9D5E2] bg-white px-4 text-sm font-bold text-[#586575]">Ignore message</button></form>
      </div>
    </article>)}{!unmatched.length && <p className="rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">No unmatched inbound messages.</p>}</div>
  </>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
