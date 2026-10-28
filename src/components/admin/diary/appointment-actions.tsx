"use client";

import { LoaderCircle, XCircle } from "lucide-react";
import { ConflictPanel, useOverrideSubmit } from "@/components/admin/diary/conflict-panel";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { DiaryFormState } from "@/lib/diary/form-state";
import { cn } from "@/lib/utils";

type FormAction = (state: DiaryFormState, formData: FormData) => Promise<DiaryFormState>;

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";

/** Cancelling always asks for a reason; viewings can also email the customer. */
export function CancelAppointment({ id, updatedAt, isViewing, customerHasEmail, action }: { id: string; updatedAt?: string; isViewing: boolean; customerHasEmail: boolean; action: FormAction }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as DiaryFormState);
  const panelId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) reasonRef.current?.focus();
  }, [open]);

  return (
    <div className="rounded-2xl border border-[#FECDCA] bg-white p-4 sm:p-5">
      <button ref={toggle} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={panelId} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FDA29B] px-4 text-sm font-bold text-[#B42318] hover:bg-[#FEF3F2]", focusRing)}>
        <XCircle size={18} aria-hidden="true" /> Cancel appointment
      </button>
      <form id={panelId} hidden={!open} action={formAction} className="mt-4 grid grid-cols-1 gap-3">
        <input type="hidden" name="id" value={id} />
        {updatedAt && <input type="hidden" name="updatedAt" value={updatedAt} />}
        <div>
          <label htmlFor={`${panelId}-reason`} className="mb-1 block text-sm font-bold text-[#0B1220]">Reason for cancelling</label>
          <textarea
            ref={reasonRef}
            id={`${panelId}-reason`}
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            required
            aria-invalid={Boolean(state.fieldErrors?.reason)}
            aria-describedby={state.fieldErrors?.reason ? `${panelId}-reason-error` : `${panelId}-reason-hint`}
            className="w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm text-[#0B1220] focus:border-[#1974E2] focus:outline-3 focus:outline-[rgba(22,139,255,.35)]"
          />
          <p id={`${panelId}-reason-hint`} className="mt-1 text-xs text-[#5B6575]">{isViewing && customerHasEmail ? "If you email the customer, this reason is included." : "Kept with the appointment for staff."}</p>
          {state.fieldErrors?.reason && <p id={`${panelId}-reason-error`} className="mt-1 text-sm font-semibold text-[#B42318]">{state.fieldErrors.reason}</p>}
        </div>
        {isViewing && (
          <label className="flex min-h-11 items-start gap-3 text-sm text-[#0B1220]">
            <input type="checkbox" name="notifyCustomer" checked={notify && customerHasEmail} disabled={!customerHasEmail} onChange={(event) => setNotify(event.target.checked)} className="mt-0.5 size-5 accent-[#1974E2]" />
            <span>{customerHasEmail ? "Email the customer that the viewing is cancelled" : "The customer did not give an email address. Call them to let them know."}</span>
          </label>
        )}
        {state.status === "error" && !state.fieldErrors && <p role="alert" className="text-sm font-semibold text-[#B42318]">{state.message}</p>}
        <ConflictPanel state={state} pending={pending} onOverride={() => undefined} compact />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#B42318] px-4 text-sm font-bold text-white hover:bg-[#912018] disabled:opacity-60", focusRing)}>
            {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />} Confirm cancellation
          </button>
          <button type="button" onClick={() => { setOpen(false); toggle.current?.focus(); }} className={cn("inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-[#344054] hover:bg-[#F3F5F8]", focusRing)}>Keep appointment</button>
        </div>
      </form>
    </div>
  );
}

/** Assign a staff member to a workshop booking, with the same clash warnings as appointments. */
export function AssignBookingStaff({ bookingId, current, staff, action }: { bookingId: string; current: string; staff: Array<{ id: string; name: string }>; action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as DiaryFormState);
  const [value, setValue] = useState(current);
  const { form, fields, submitWithOverride } = useOverrideSubmit();
  return (
    <form ref={form} action={formAction} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      {fields}
      <div>
        <label htmlFor="booking-staff" className="mb-1 block text-sm font-bold text-[#0B1220]">Staff member</label>
        <div className="flex flex-wrap gap-2">
          <select id="booking-staff" name="assignedTo" value={value} onChange={(event) => setValue(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm text-[#0B1220] focus:border-[#1974E2] focus:outline-3 focus:outline-[rgba(22,139,255,.35)]">
            <option value="">Unassigned</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <button type="submit" disabled={pending} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-bold text-white hover:bg-[#1462C4] disabled:opacity-60", focusRing)}>
            {pending && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />} Save
          </button>
        </div>
      </div>
      {state.status === "saved" && <p role="status" className="text-sm font-semibold text-[#067647]">{state.message}</p>}
      {state.status === "error" && <p role="alert" className="text-sm font-semibold text-[#B42318]">{state.message}</p>}
      <ConflictPanel state={state} pending={pending} actionLabel="Assign anyway" onOverride={submitWithOverride} compact />
    </form>
  );
}
