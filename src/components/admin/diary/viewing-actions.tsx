"use client";

import { CalendarClock, Check, LoaderCircle, MailWarning, RotateCw, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { DiaryFormState } from "@/lib/diary/form-state";
import { cn } from "@/lib/utils";

type FormAction = (state: DiaryFormState, formData: FormData) => Promise<DiaryFormState>;

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";
const initialState: DiaryFormState = { status: "idle" };

function Feedback({ state }: { state: DiaryFormState }) {
  if (state.status === "idle") return null;
  const failedEmail = state.email && state.email.status === "failed";
  return (
    <div role={state.status === "error" ? "alert" : "status"} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", state.status === "error" ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#ECFDF3] text-[#067647]")}>
      {state.message}
      {state.email && state.status !== "error" && <span className={cn("mt-0.5 block font-normal", failedEmail ? "text-[#B42318]" : "text-[#344054]")}>{state.email.message}</span>}
    </div>
  );
}

/** Confirm / Propose another time / Decline for a requested viewing. */
export function ViewingRequestActions({ id, defaultDate, defaultTime, confirm, propose, decline, compact = false }: {
  id: string;
  defaultDate: string;
  defaultTime: string;
  confirm: FormAction;
  propose: FormAction;
  decline: FormAction;
  compact?: boolean;
}) {
  const [confirmState, confirmAction, confirming] = useActionState(confirm, initialState);
  const [proposeState, proposeAction, proposing] = useActionState(propose, initialState);
  const [declineState, declineAction, declining] = useActionState(decline, initialState);
  const [panel, setPanel] = useState<"none" | "propose" | "decline">("none");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const uid = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (panel === "propose") firstField.current?.focus();
    if (panel === "decline") reasonField.current?.focus();
  }, [panel]);

  const busy = confirming || proposing || declining;

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
        <form action={confirmAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={busy} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#067647] px-4 text-sm font-bold text-white hover:bg-[#05603A] disabled:opacity-60", focusRing)}>
            {confirming ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />} Confirm
          </button>
        </form>
        <button type="button" onClick={() => setPanel(panel === "propose" ? "none" : "propose")} aria-expanded={panel === "propose"} aria-controls={`${uid}-propose`} disabled={busy} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-bold text-[#0B1220] hover:border-[#1974E2] disabled:opacity-60", focusRing)}>
          <CalendarClock size={17} aria-hidden="true" /> Propose another time
        </button>
        <button type="button" onClick={() => setPanel(panel === "decline" ? "none" : "decline")} aria-expanded={panel === "decline"} aria-controls={`${uid}-decline`} disabled={busy} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FDA29B] bg-white px-4 text-sm font-bold text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60", focusRing)}>
          <X size={17} aria-hidden="true" /> Decline
        </button>
      </div>

      <form id={`${uid}-propose`} hidden={panel !== "propose"} action={proposeAction} className="grid grid-cols-1 gap-3 rounded-xl border border-[#E3E8EF] bg-[#F8FAFC] p-3">
        <input type="hidden" name="id" value={id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-date`} className="mb-1 block text-sm font-bold text-[#0B1220]">New date</label>
            <input ref={firstField} id={`${uid}-date`} type="date" name="date" value={date} onChange={(event) => setDate(event.target.value)} required className="h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm" />
            {proposeState.fieldErrors?.date && <p className="mt-1 text-sm font-semibold text-[#B42318]">{proposeState.fieldErrors.date}</p>}
          </div>
          <div>
            <label htmlFor={`${uid}-time`} className="mb-1 block text-sm font-bold text-[#0B1220]">New time (UK)</label>
            <input id={`${uid}-time`} type="time" name="startTime" step={300} value={time} onChange={(event) => setTime(event.target.value)} required className="h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm" />
            {proposeState.fieldErrors?.startTime && <p className="mt-1 text-sm font-semibold text-[#B42318]">{proposeState.fieldErrors.startTime}</p>}
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}-note`} className="mb-1 block text-sm font-bold text-[#0B1220]">Note to the customer <span className="font-normal text-[#5B6575]">(optional)</span></label>
          <textarea id={`${uid}-note`} name="message" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-[#5B6575]">The viewing stays a request until the customer agrees and you confirm it.</p>
        <button type="submit" disabled={busy} className={cn("inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-bold text-white hover:bg-[#1462C4] disabled:opacity-60", focusRing)}>
          {proposing && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />} Send suggested time
        </button>
      </form>

      <form id={`${uid}-decline`} hidden={panel !== "decline"} action={declineAction} className="grid grid-cols-1 gap-3 rounded-xl border border-[#FECDCA] bg-[#FEF3F2]/40 p-3">
        <input type="hidden" name="id" value={id} />
        <div>
          <label htmlFor={`${uid}-reason`} className="mb-1 block text-sm font-bold text-[#0B1220]">Reason (sent to the customer)</label>
          <textarea ref={reasonField} id={`${uid}-reason`} name="reason" rows={2} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm" />
          {declineState.fieldErrors?.reason && <p className="mt-1 text-sm font-semibold text-[#B42318]">{declineState.fieldErrors.reason}</p>}
        </div>
        <button type="submit" disabled={busy} className={cn("inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[#B42318] px-4 text-sm font-bold text-white hover:bg-[#912018] disabled:opacity-60", focusRing)}>
          {declining && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />} Decline viewing
        </button>
      </form>

      <Feedback state={confirmState} />
      <Feedback state={proposeState} />
      <Feedback state={declineState} />
    </div>
  );
}

/** Shows a failed customer email with a Retry button. */
export function EmailFailure({ id, label, retry }: { id: string; label: string; retry: FormAction }) {
  const [state, action, pending] = useActionState(retry, initialState);
  if (state.status === "saved") return <p role="status" className="rounded-xl bg-[#ECFDF3] px-3 py-2 text-sm font-semibold text-[#067647]">{state.message}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] px-3 py-2 text-sm text-[#B42318]">
      <MailWarning size={17} aria-hidden="true" />
      <span className="min-w-0 flex-1 font-semibold">{state.status === "error" ? state.message : label}</span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={pending} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-3 font-bold text-[#B42318] ring-1 ring-[#FDA29B] hover:bg-[#FEF3F2] disabled:opacity-60", focusRing)}>
          {pending ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <RotateCw size={15} aria-hidden="true" />} Retry email
        </button>
      </form>
    </div>
  );
}
