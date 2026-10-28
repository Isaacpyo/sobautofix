import { UserRound } from "lucide-react";
import type { ThreadMessage } from "@/lib/exchange/admin/threads";
import { formatDateTime } from "./labels";

/** The enquiry email thread, styled like the main Enquiries conversation view. */
export function EnquiryThread({ messages }: { messages: ThreadMessage[] }) {
  return <section aria-labelledby="thread-heading" className="rounded-xl border border-[#D6E3F0] bg-[#EAF2FA] p-3 sm:p-4">
    <div className="flex items-center justify-between gap-4">
      <h3 id="thread-heading" className="text-lg font-extrabold text-[#071127]">Conversation</h3>
      <span className="text-sm text-[#667586]">{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
    </div>
    <ol className="mt-2.5 grid gap-2">
      {messages.map((message) => <li key={message.id}><ThreadItem message={message} /></li>)}
      {!messages.length && <li className="rounded-xl border border-[#E4EAF0] bg-white p-6 text-center text-sm text-[#667586]">No messages yet.</li>}
    </ol>
  </section>;
}

function ThreadItem({ message }: { message: ThreadMessage }) {
  const internal = message.direction === "internal";
  const outbound = message.direction === "outbound";
  const heading = message.message_type === "website_enquiry" ? "Customer enquiry" : message.message_type === "automatic_confirmation" ? "SOB Autofix · Automatic confirmation" : internal ? "Internal note" : outbound ? "SOB Autofix" : "Customer";
  return <article className={`rounded-xl border p-3 ${internal ? "border-amber-300 bg-amber-50" : outbound ? "border-[#8EBEF5] bg-[#EAF3FF]" : "border-emerald-200 bg-white"}`}>
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full text-[0.6rem] font-black ${internal ? "bg-amber-200 text-amber-950" : outbound ? "bg-[#1446A5] text-white" : "bg-emerald-100 text-emerald-800"}`}>{internal ? "IN" : outbound ? "SOB" : <UserRound size={16} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h4 className={`text-sm leading-5 font-extrabold ${internal ? "text-amber-950" : outbound ? "text-[#1446A5]" : "text-emerald-900"}`}>{heading}</h4>{(outbound || internal) && message.sender_name && <p className="text-[0.7rem] leading-4 text-[#586575]">By {message.sender_name}</p>}</div>
          <time className="text-[0.7rem] leading-4 text-[#586575]" dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
        </div>
        <p className="mt-1.5 text-sm leading-5 break-words whitespace-pre-wrap text-[#263446]">{message.text_body}</p>
        {(outbound || message.delivery_status === "failed") && <p className={`mt-1.5 text-[0.65rem] font-bold tracking-wide uppercase ${message.delivery_status === "failed" || message.delivery_status === "bounced" ? "text-red-700" : "text-[#586575]"}`}>{message.delivery_status === "failed" ? "Failed to send" : message.delivery_status}</p>}
      </div>
    </div>
  </article>;
}
