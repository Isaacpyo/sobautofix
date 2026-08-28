"use client";

import { CheckCircle2, Clock3, MailWarning, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

export type EmailDeliveryAttempt = {
  id: number;
  enquiry_id: string;
  recipient_type: "business" | "customer";
  status: "pending" | "sent" | "failed";
  error_code: string | null;
  attempted_at: string;
};

export function EmailDeliveryDrawer({ attempts }: { attempts: EmailDeliveryAttempt[] }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("all");
  const [recipient, setRecipient] = useState("all");
  const panelId = useId();
  const filteredAttempts = attempts.filter((attempt) =>
    (status === "all" || attempt.status === status) &&
    (recipient === "all" || attempt.recipient_type === recipient));

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)} className="rounded-xl border border-[#C9D5E2] bg-white px-4 py-2 text-sm font-bold text-[#071127] hover:border-[#1974E2]">
      Email delivery history
    </button>
    {open && <>
      <button type="button" aria-label="Close email delivery history" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-[#071127]/25" />
      <aside id={panelId} role="dialog" aria-modal="true" aria-labelledby={`${panelId}-heading`} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#D7E0E9] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#E4EAF0] px-5 py-4">
          <div><h2 id={`${panelId}-heading`} className="text-xl font-extrabold text-[#071127]">Email delivery history</h2><p className="mt-1 text-xs text-[#667586]">Latest enquiry notification attempts</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full text-[#586575] hover:bg-[#F4F7FA]"><X size={20} /></button>
        </header>
        <div className="grid grid-cols-2 gap-3 border-b border-[#E4EAF0] bg-[#F8FAFC] p-4">
          <label className="grid gap-1 text-xs font-bold text-[#586575]">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-10 rounded-lg border border-[#C9D5E2] bg-white px-3 text-sm font-semibold text-[#071127]"><option value="all">All statuses</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="sent">Sent</option></select></label>
          <label className="grid gap-1 text-xs font-bold text-[#586575]">Recipient<select value={recipient} onChange={(event) => setRecipient(event.target.value)} className="min-h-10 rounded-lg border border-[#C9D5E2] bg-white px-3 text-sm font-semibold text-[#071127]"><option value="all">All recipients</option><option value="business">Business</option><option value="customer">Customer</option></select></label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredAttempts.map((attempt) => <div key={attempt.id} className="border-b border-[#E4EAF0] p-5">
            <div className="flex items-start gap-3">
              {attempt.status === "sent" ? <CheckCircle2 className="mt-0.5 shrink-0 text-green-700" size={19} /> : attempt.status === "failed" ? <MailWarning className="mt-0.5 shrink-0 text-red-700" size={19} /> : <Clock3 className="mt-0.5 shrink-0 text-amber-700" size={19} />}
              <div className="min-w-0 flex-1"><p className="font-bold text-[#071127]">{attempt.recipient_type === "business" ? "Business notification" : "Customer confirmation"}</p><p className="mt-1 text-xs text-[#667586]">{formatDate(attempt.attempted_at)}{attempt.error_code ? ` · ${attempt.error_code}` : ""}</p><Link href={`/admin/enquiries/${attempt.enquiry_id}`} onClick={() => setOpen(false)} className="mt-3 inline-block text-sm font-bold text-[#1974E2]">Open enquiry</Link></div>
            </div>
          </div>)}
          {!filteredAttempts.length && <p className="p-8 text-center text-[#667586]">No email attempts match these filters.</p>}
        </div>
      </aside>
    </>}
  </>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}
