"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";

export type UnmatchedInboundEmail = { id: string; sender_email: string; subject: string; text_body: string; reason: string; created_at: string };
export type EnquiryMatchOption = { id: string; type: string; created_at: string; customerName: string };

export function UnmatchedInboundDrawer({ messages, enquiries, linkAction, ignoreAction }: {
  messages: UnmatchedInboundEmail[];
  enquiries: EnquiryMatchOption[];
  linkAction: (formData: FormData) => void | Promise<void>;
  ignoreAction: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950 hover:border-amber-500">
      Unmatched inbound{messages.length ? ` (${messages.length})` : ""}
    </button>
    {open && <>
      <button type="button" aria-label="Close unmatched inbound email" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-[#071127]/25" />
      <aside id={panelId} role="dialog" aria-modal="true" aria-labelledby={`${panelId}-heading`} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[#D7E0E9] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#E4EAF0] px-5 py-4">
          <div><h2 id={`${panelId}-heading`} className="text-xl font-extrabold text-[#071127]">Unmatched inbound email</h2><p className="mt-1 max-w-md text-xs leading-5 text-[#667586]">These messages were not linked automatically. Review the content and choose an enquiry only when the relationship is certain.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-full text-[#586575] hover:bg-[#F4F7FA]"><X size={20} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] p-4">
          <div className="grid gap-4">{messages.map((message) => <article key={message.id} className="rounded-2xl border border-amber-200 bg-white p-5">
            <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="truncate font-extrabold text-[#071127]">{message.sender_email}</p><p className="mt-1 text-sm font-bold text-[#586575]">{message.subject}</p></div><time className="text-xs text-[#667586]">{formatDate(message.created_at)}</time></div>
            <p className="mt-4 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[#F4F7FA] p-3 text-sm leading-6 text-[#263446]">{message.text_body}</p>
            <p className="mt-3 text-xs font-bold text-amber-800">Reason: {message.reason.replaceAll("_", " ")}</p>
            <div className="mt-4 grid gap-2">
              {enquiries.length > 0 && <form action={linkAction} className="grid gap-2"><input type="hidden" name="unmatchedId" value={message.id} /><label className="grid gap-1 text-xs font-bold text-[#071127]">Link to enquiry<select name="enquiryId" required className="min-h-11 min-w-0 rounded-xl border border-[#D7E0E9] bg-white px-3 text-sm font-normal"><option value="">Select an enquiry</option>{enquiries.map((enquiry) => <option key={enquiry.id} value={enquiry.id}>{enquiry.customerName} · {enquiry.type.replaceAll("_", " ")} · {new Date(enquiry.created_at).toLocaleDateString("en-GB")}</option>)}</select></label><button className="min-h-10 rounded-xl bg-[#071127] px-4 text-sm font-bold text-white">Link message</button></form>}
              <form action={ignoreAction}><input type="hidden" name="unmatchedId" value={message.id} /><button className="min-h-10 w-full rounded-xl border border-[#C9D5E2] bg-white px-4 text-sm font-bold text-[#586575]">Ignore message</button></form>
            </div>
          </article>)}{!messages.length && <p className="rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">No unmatched inbound messages.</p>}</div>
        </div>
      </aside>
    </>}
  </>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
