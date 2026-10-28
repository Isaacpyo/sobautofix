"use client";

import { AlertTriangle, CalendarClock, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LinkPicker } from "@/components/admin/diary/link-picker";
import type { DiaryFormState } from "@/lib/diary/form-state";
import type { LinkKind, LinkOption } from "@/lib/diary/repository";
import { addMinutesToTime, defaultTitle, editableStatuses } from "@/lib/diary/schema";
import { clockChangeNote } from "@/lib/diary/time";
import { appointmentKinds, appointmentStatusLabels, diaryTypeLabels, type AppointmentKind } from "@/lib/diary/types";
import { cn } from "@/lib/utils";

export type AppointmentFormValues = {
  id?: string;
  kind: AppointmentKind;
  status: (typeof editableStatuses)[number];
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  assignedTo: string;
  notes: string;
  links: Partial<Record<LinkKind, LinkOption | null>>;
};

type SaveAction = (state: DiaryFormState, formData: FormData) => Promise<DiaryFormState>;
type SearchAction = (kind: LinkKind, query: string) => Promise<{ ok: boolean; options: LinkOption[]; message?: string }>;

const fieldClass = "h-11 w-full rounded-xl border bg-white px-3 text-sm text-[#0B1220] focus:border-[#1974E2] focus:outline-3 focus:outline-[rgba(22,139,255,.35)]";
const labelClass = "mb-1 block text-sm font-bold text-[#0B1220]";
const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";

const linkFields: Array<{ kind: LinkKind; name: string; label: string; hint?: string }> = [
  { kind: "vehicle", name: "vehicleId", label: "Stock vehicle" },
  { kind: "customer", name: "customerId", label: "Customer" },
  { kind: "enquiry", name: "enquiryId", label: "Enquiry", hint: "Sales or buying enquiry this belongs to" },
  { kind: "submission", name: "submissionId", label: "Seller submission" },
  { kind: "sale", name: "saleId", label: "Vehicle sale", hint: "For handovers and collections" },
];

export function AppointmentForm({ initial, staff, permissions, customerHasEmail, defaultLengthMinutes, action, search, cancelHref }: {
  initial: AppointmentFormValues;
  staff: Array<{ id: string; name: string }>;
  permissions: { links: Record<LinkKind, boolean>; notes: boolean };
  customerHasEmail: boolean;
  defaultLengthMinutes: number;
  action: SaveAction;
  search: SearchAction;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as DiaryFormState);
  const [values, setValues] = useState(initial);
  const [titleTouched, setTitleTouched] = useState(Boolean(initial.id));
  const [notify, setNotify] = useState(true);
  const alertRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const acknowledgeInput = useRef<HTMLInputElement>(null);
  const errors = state.fieldErrors ?? {};
  const editing = Boolean(initial.id);
  const timeChanged = values.date !== initial.date || values.startTime !== initial.startTime;
  const confirmingViewing = values.kind === "viewing" && values.status === "confirmed" && initial.status !== "confirmed";
  const showNotify = editing && values.kind === "viewing" && Boolean(values.links.customer) && (timeChanged || confirmingViewing);

  useEffect(() => {
    if (state.status === "conflict" || state.status === "error") alertRef.current?.focus();
  }, [state]);

  function set<K extends keyof AppointmentFormValues>(key: K, value: AppointmentFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (!titleTouched && (key === "kind" || key === "links")) next.title = defaultTitle(next.kind, next.links.vehicle?.label);
      return next;
    });
  }

  /** Resubmits with the clashes acknowledged. Enter in a field never does this by accident. */
  function saveAnyway(signature: string) {
    if (acknowledgeInput.current) acknowledgeInput.current.value = signature;
    formRef.current?.requestSubmit();
  }

  function setLink(kind: LinkKind, option: LinkOption | null) {
    set("links", { ...values.links, [kind]: option });
  }

  function setStart(time: string) {
    setValues((current) => {
      const [startHour = 0, startMinute = 0] = current.startTime.split(":").map(Number);
      const [endHour = 0, endMinute = 0] = current.endTime.split(":").map(Number);
      const length = Math.max(15, endHour * 60 + endMinute - (startHour * 60 + startMinute)) || defaultLengthMinutes;
      return { ...current, startTime: time, endTime: time ? addMinutesToTime(time, length) : current.endTime };
    });
  }

  const describe = (field: string, extra?: string) => [errors[field] ? `${field}-error` : null, extra].filter(Boolean).join(" ") || undefined;
  const fieldError = (field: string) => errors[field] ? <p id={`${field}-error`} className="mt-1 text-sm font-semibold text-[#B42318]">{errors[field]}</p> : null;
  const clockNote = clockChangeNote(values.date, values.startTime);

  return (
    <form ref={formRef} action={formAction} className="grid gap-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input ref={acknowledgeInput} type="hidden" name="acknowledgedConflicts" defaultValue="" />

      {state.status === "conflict" && state.conflicts?.length ? (
        <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-2xl border border-[#FEC84B] bg-[#FFFAEB] p-4 text-[#7A2E0E] outline-none focus-visible:ring-4 focus-visible:ring-[#FEC84B]/50">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold">Possible clash</h2>
              <p className="mt-1 text-sm">{state.message}</p>
              <ul className="mt-3 grid gap-2">
                {state.conflicts.map((conflict) => (
                  <li key={conflict.key} className="rounded-xl bg-white/70 p-3 text-sm ring-1 ring-[#FEDF89]">
                    <p className="font-bold text-[#0B1220]">{conflict.reason}</p>
                    <p className="mt-0.5 text-[#344054]"><Link href={conflict.href} className="font-semibold text-[#1462C4] underline" target="_blank" rel="noopener">{conflict.title}<span className="sr-only"> (opens in a new tab)</span></Link> ({conflict.type}, {conflict.status})</p>
                    <p className="text-[#344054]">{conflict.when}{conflict.staff ? ` · ${conflict.staff}` : ""}{conflict.vehicle ? ` · ${conflict.vehicle}` : ""}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => saveAnyway(state.signature ?? "")} disabled={pending} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#B54708] px-4 text-sm font-bold text-white hover:bg-[#93370D] disabled:opacity-60", focusRing)}>
                  Save anyway
                </button>
                <button type="button" onClick={() => document.getElementById("appointment-date")?.focus()} className={cn("inline-flex min-h-11 items-center rounded-xl border border-[#B54708] bg-white px-4 text-sm font-bold text-[#93370D]", focusRing)}>
                  Change the time
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {state.status === "error" && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] p-4 text-sm font-semibold text-[#B42318] outline-none">
          {state.message}
        </div>
      )}

      <section className="grid gap-4 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:p-6" aria-labelledby="appointment-what">
        <h2 id="appointment-what" className="text-lg font-extrabold text-[#0B1220]">Appointment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="appointment-kind" className={labelClass}>Type</label>
            <select id="appointment-kind" name="kind" value={values.kind} onChange={(event) => set("kind", event.target.value as AppointmentKind)} aria-invalid={Boolean(errors.kind)} aria-describedby={describe("kind")} className={cn(fieldClass, errors.kind ? "border-[#B42318]" : "border-[#D0D5DD]")}>
              {appointmentKinds.map((kind) => <option key={kind} value={kind}>{diaryTypeLabels[kind]}</option>)}
            </select>
            {fieldError("kind")}
          </div>
          <div>
            <label htmlFor="appointment-status" className={labelClass}>Status</label>
            <select id="appointment-status" name="status" value={values.status} onChange={(event) => set("status", event.target.value as AppointmentFormValues["status"])} className={cn(fieldClass, "border-[#D0D5DD]")}>
              {editableStatuses.map((status) => <option key={status} value={status}>{appointmentStatusLabels[status]}</option>)}
            </select>
            {fieldError("status")}
          </div>
        </div>
        <div>
          <label htmlFor="appointment-title" className={labelClass}>Title</label>
          <input id="appointment-title" name="title" value={values.title} maxLength={160} required onChange={(event) => { setTitleTouched(true); set("title", event.target.value); }} aria-invalid={Boolean(errors.title)} aria-describedby={describe("title")} className={cn(fieldClass, errors.title ? "border-[#B42318]" : "border-[#D0D5DD]")} />
          {fieldError("title")}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:p-6" aria-labelledby="appointment-when">
        <h2 id="appointment-when" className="flex items-center gap-2 text-lg font-extrabold text-[#0B1220]"><CalendarClock size={20} className="text-[#1974E2]" aria-hidden="true" /> When and who</h2>
        <p id="time-zone-hint" className="-mt-2 text-sm text-[#5B6575]">UK time (GMT in winter, BST in summer).</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="appointment-date" className={labelClass}>Date</label>
            <input id="appointment-date" type="date" name="date" value={values.date} required onChange={(event) => set("date", event.target.value)} aria-invalid={Boolean(errors.date)} aria-describedby={describe("date", "time-zone-hint")} className={cn(fieldClass, errors.date ? "border-[#B42318]" : "border-[#D0D5DD]")} />
            {fieldError("date")}
          </div>
          <div>
            <label htmlFor="appointment-start" className={labelClass}>Start</label>
            <input id="appointment-start" type="time" name="startTime" value={values.startTime} step={300} required onChange={(event) => setStart(event.target.value)} aria-invalid={Boolean(errors.startTime)} aria-describedby={describe("startTime", "time-zone-hint")} className={cn(fieldClass, errors.startTime ? "border-[#B42318]" : "border-[#D0D5DD]")} />
            {fieldError("startTime")}
          </div>
          <div>
            <label htmlFor="appointment-end" className={labelClass}>End</label>
            <input id="appointment-end" type="time" name="endTime" value={values.endTime} step={300} required onChange={(event) => set("endTime", event.target.value)} aria-invalid={Boolean(errors.endTime)} aria-describedby={describe("endTime", "time-zone-hint")} className={cn(fieldClass, errors.endTime ? "border-[#B42318]" : "border-[#D0D5DD]")} />
            {fieldError("endTime")}
          </div>
        </div>
        {clockNote && (
          <p className="rounded-xl bg-[#FFFAEB] px-3 py-2 text-sm font-semibold text-[#93370D]" role="status">
            {clockNote === "skipped" ? "The clocks go forward at 01:00 on this date, so 01:00 to 01:59 does not exist." : "The clocks go back at 02:00 on this date, so 01:00 to 01:59 happens twice. This time is saved as the first one (BST)."}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="appointment-staff" className={labelClass}>Staff member</label>
            <select id="appointment-staff" name="assignedTo" value={values.assignedTo} onChange={(event) => set("assignedTo", event.target.value)} aria-invalid={Boolean(errors.assignedTo)} aria-describedby={describe("assignedTo")} className={cn(fieldClass, errors.assignedTo ? "border-[#B42318]" : "border-[#D0D5DD]")}>
              <option value="">Unassigned</option>
              {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            {fieldError("assignedTo")}
          </div>
          <div>
            <label htmlFor="appointment-location" className={labelClass}>Location <span className="font-normal text-[#5B6575]">(optional)</span></label>
            <input id="appointment-location" name="location" value={values.location} maxLength={200} onChange={(event) => set("location", event.target.value)} placeholder="SOB Autofix, Station Road" aria-describedby={describe("location")} className={cn(fieldClass, "border-[#D0D5DD]")} />
            {fieldError("location")}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:p-6" aria-labelledby="appointment-links">
        <h2 id="appointment-links" className="text-lg font-extrabold text-[#0B1220]">Linked records</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {linkFields.map((field) => (
            <LinkPicker
              key={field.kind}
              kind={field.kind}
              name={field.name}
              label={field.label}
              hint={field.hint}
              value={values.links[field.kind] ?? null}
              onChange={(option) => setLink(field.kind, option)}
              search={search}
              disabled={!permissions.links[field.kind]}
              disabledReason={!permissions.links[field.kind] ? "Your role cannot change this link." : undefined}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:p-6" aria-labelledby="appointment-notes-heading">
        <h2 id="appointment-notes-heading" className="text-lg font-extrabold text-[#0B1220]">Internal notes</h2>
        {permissions.notes ? (
          <>
            <label htmlFor="appointment-notes" className="text-sm text-[#5B6575]">Staff only. Never shown to customers.</label>
            <textarea id="appointment-notes" name="notes" value={values.notes} maxLength={4000} rows={4} onChange={(event) => set("notes", event.target.value)} aria-describedby={describe("notes")} className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#0B1220] focus:border-[#1974E2] focus:outline-3 focus:outline-[rgba(22,139,255,.35)]" />
            {fieldError("notes")}
          </>
        ) : (
          <p className="text-sm text-[#5B6575]">Notes on this appointment are visible to sales and management roles only.</p>
        )}
      </section>

      {showNotify && (
        <div className="rounded-2xl border border-[#BCD6F6] bg-[#F5F9FF] p-4">
          <label className="flex min-h-11 items-start gap-3 text-sm text-[#0B1220]">
            <input type="checkbox" name="notifyCustomer" checked={notify && customerHasEmail} disabled={!customerHasEmail} onChange={(event) => setNotify(event.target.checked)} className="mt-0.5 size-5 accent-[#1974E2]" />
            <span>
              <span className="block font-bold">{confirmingViewing ? "Email the customer to confirm the viewing" : "Email the customer about the new time"}</span>
              <span className="block text-[#5B6575]">{customerHasEmail ? "Includes the car, the date and time and our address." : "This customer did not give an email address. Call them instead."}</span>
            </span>
          </label>
        </div>
      )}

      <div className="sticky bottom-[calc(64px_+_env(safe-area-inset-bottom))] z-20 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E3E8EF] bg-white/95 p-3 shadow-[0_-6px_20px_rgba(11,18,32,.06)] backdrop-blur lg:bottom-4">
        <button type="submit" disabled={pending} className={cn("inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1974E2] px-5 text-sm font-bold text-white hover:bg-[#1462C4] disabled:opacity-60 sm:flex-none", focusRing)}>
          {pending && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}
          {editing ? "Save changes" : "Save appointment"}
        </button>
        <Link href={cancelHref} className={cn("inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-[#344054] hover:bg-[#F3F5F8]", focusRing)}>Back</Link>
        <p className="sr-only" aria-live="polite">{pending ? "Saving" : ""}</p>
      </div>
    </form>
  );
}
