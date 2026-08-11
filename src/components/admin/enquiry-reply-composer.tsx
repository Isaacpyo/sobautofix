"use client";

import { useActionState, useState } from "react";
import type { ReplyState } from "@/lib/enquiries/thread-repository";

type ReplyAction = (state: ReplyState, formData: FormData) => Promise<ReplyState>;

export function EnquiryReplyComposer({
  enquiryId,
  customerEmail,
  initialClientRequestId,
  replyAction,
  noteAction,
}: {
  enquiryId: string;
  customerEmail: string | null;
  initialClientRequestId: string;
  replyAction: ReplyAction;
  noteAction: ReplyAction;
}) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const initial: ReplyState = { status: "idle", message: "", draft: "", clientRequestId: initialClientRequestId };
  const [replyState, submitReply, replyPending] = useActionState(replyAction, initial);
  const [noteState, submitNote, notePending] = useActionState(noteAction, initial);
  const pending = mode === "reply" ? replyPending : notePending;

  return (
    <section aria-labelledby="composer-heading" className="sticky bottom-4 mt-8 rounded-2xl border border-[#D7E0E9] bg-white p-4 shadow-[0_18px_50px_rgba(7,17,39,0.14)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="composer-heading" className="text-xl font-extrabold text-[#071127]">Write a message</h2>
        <div className="inline-flex rounded-xl bg-[#F1F5F9] p-1" aria-label="Message type">
          <button type="button" onClick={() => setMode("reply")} aria-pressed={mode === "reply"} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${mode === "reply" ? "bg-white text-[#1974E2] shadow-sm" : "text-[#586575]"}`}>Reply to customer</button>
          <button type="button" onClick={() => setMode("note")} aria-pressed={mode === "note"} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${mode === "note" ? "bg-amber-100 text-amber-950 shadow-sm" : "text-[#586575]"}`}>Internal note</button>
        </div>
      </div>

      {mode === "reply" ? (
        <form action={submitReply} className="mt-4">
          <input type="hidden" name="enquiryId" value={enquiryId} />
          <input type="hidden" name="clientRequestId" value={replyState.clientRequestId} />
          <p className="text-sm text-[#586575]">To: <span className="font-bold text-[#071127]">{customerEmail || "No customer email available"}</span></p>
          <label htmlFor="reply-body" className="sr-only">Reply to customer</label>
          <textarea id="reply-body" name="body" key={replyState.clientRequestId} defaultValue={replyState.draft} required maxLength={20000} rows={7} disabled={!customerEmail || pending} className="mt-3 w-full resize-y rounded-xl border border-[#C9D4DF] px-4 py-3 leading-7 text-[#071127] outline-none focus:border-[#1974E2] focus:ring-2 focus:ring-[#1974E2]/20 disabled:bg-[#F4F7FA]" placeholder="Write your reply..." />
          <ComposerFooter state={replyState} pending={pending} disabled={!customerEmail} label="Send reply" />
        </form>
      ) : (
        <form action={submitNote} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <input type="hidden" name="enquiryId" value={enquiryId} />
          <p className="text-sm font-bold text-amber-950">Only SOB Autofix staff can see this. It will never be emailed.</p>
          <label htmlFor="note-body" className="sr-only">Internal note</label>
          <textarea id="note-body" name="body" key={noteState.clientRequestId} defaultValue={noteState.draft} required maxLength={20000} rows={5} disabled={pending} className="mt-3 w-full resize-y rounded-xl border border-amber-300 bg-white px-4 py-3 leading-7 text-[#071127] outline-none focus:ring-2 focus:ring-amber-400/30" placeholder="Add a private note..." />
          <ComposerFooter state={noteState} pending={pending} label="Save as note" />
        </form>
      )}
    </section>
  );
}

function ComposerFooter({ state, pending, disabled = false, label }: { state: ReplyState; pending: boolean; disabled?: boolean; label: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className={`text-sm ${state.status === "error" ? "font-bold text-red-700" : "text-green-700"}`}>{state.message}</p>
      <button disabled={disabled || pending} className="min-h-11 rounded-xl bg-[#1974E2] px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving..." : label}</button>
    </div>
  );
}
