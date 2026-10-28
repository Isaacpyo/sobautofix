"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { DiaryFormState } from "@/lib/diary/form-state";
import { cn } from "@/lib/utils";

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";

/**
 * Warnings returned by a diary save (clashes, configured opening hours). Going
 * ahead needs a reason, which is stored on the appointment. Also shows the
 * "changed by someone else" state for compare-and-set saves.
 */
export function ConflictPanel({ state, pending, actionLabel = "Save anyway", onOverride, onChangeTime, compact = false }: {
  state: DiaryFormState;
  pending: boolean;
  actionLabel?: string;
  onOverride: (signature: string, reason: string) => void;
  onChangeTime?: () => void;
  compact?: boolean;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "conflict" || state.status === "stale") panel.current?.focus();
  }, [state]);

  if (state.status === "stale") {
    return (
      <div ref={panel} tabIndex={-1} role="alert" className="rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] p-4 text-sm text-[#B42318] outline-none">
        <p className="font-extrabold">Changed by someone else</p>
        <p className="mt-1 text-[#344054]">{state.message}</p>
        <button type="button" onClick={() => window.location.reload()} className={cn("mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FDA29B] bg-white px-4 font-bold text-[#B42318]", focusRing)}>
          <RefreshCw size={16} aria-hidden="true" /> Reload latest version
        </button>
      </div>
    );
  }
  if (state.status !== "conflict" || !state.conflicts?.length) return null;
  const reasonError = state.fieldErrors?.overrideReason;
  const tooShort = reason.trim().length < 3;

  return (
    <div ref={panel} tabIndex={-1} role="alert" aria-labelledby={`${id}-title`} className={cn("rounded-2xl border border-[#FEC84B] bg-[#FFFAEB] text-[#7A2E0E] outline-none focus-visible:ring-4 focus-visible:ring-[#FEC84B]/50", compact ? "p-3" : "p-4")}>
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="font-extrabold">Check before saving</h2>
          <p className="mt-1 text-sm">{state.message}</p>
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {state.conflicts.map((conflict) => (
              <li key={conflict.key} className="rounded-xl bg-white/80 p-3 text-sm ring-1 ring-[#FEDF89]">
                <p className="font-bold text-[#0B1220]">{conflict.reason}</p>
                <p className="mt-0.5 text-[#344054]"><Link href={conflict.href} className="font-semibold text-[#1462C4] underline" target="_blank" rel="noopener">{conflict.title}<span className="sr-only"> (opens in a new tab)</span></Link> ({conflict.type}, {conflict.status})</p>
                <p className="text-[#344054]">{conflict.when}{conflict.staff ? ` · ${conflict.staff}` : ""}{conflict.vehicle ? ` · ${conflict.vehicle}` : ""}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <label htmlFor={`${id}-reason`} className="mb-1 block text-sm font-bold text-[#0B1220]">Reason for going ahead</label>
            <textarea id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} aria-invalid={Boolean(reasonError)} aria-describedby={`${id}-reason-hint`} className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#0B1220] focus:border-[#1974E2] focus:outline-3 focus:outline-[rgba(22,139,255,.35)]" />
            <p id={`${id}-reason-hint`} className={cn("mt-1 text-xs", reasonError ? "font-semibold text-[#B42318]" : "text-[#5B6575]")}>{reasonError ?? "Saved with the appointment and in its history, with your name."}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending || tooShort} onClick={() => onOverride(state.signature ?? "", reason)} className={cn("inline-flex min-h-11 items-center rounded-xl bg-[#B54708] px-4 text-sm font-bold text-white hover:bg-[#93370D] disabled:cursor-not-allowed disabled:opacity-60", focusRing)}>
              {actionLabel}
            </button>
            {onChangeTime && <button type="button" onClick={onChangeTime} className={cn("inline-flex min-h-11 items-center rounded-xl border border-[#B54708] bg-white px-4 text-sm font-bold text-[#93370D]", focusRing)}>Change the time</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hidden fields a form needs to carry an override, plus a helper to resubmit with one. */
export function useOverrideSubmit() {
  const form = useRef<HTMLFormElement>(null);
  const acknowledged = useRef<HTMLInputElement>(null);
  const reason = useRef<HTMLInputElement>(null);
  const fields = (
    <>
      <input ref={acknowledged} type="hidden" name="acknowledgedConflicts" defaultValue="" />
      <input ref={reason} type="hidden" name="overrideReason" defaultValue="" />
    </>
  );
  function submitWithOverride(signature: string, why: string) {
    if (acknowledged.current) acknowledged.current.value = signature;
    if (reason.current) reason.current.value = why;
    form.current?.requestSubmit();
  }
  return { form, fields, submitWithOverride };
}
