"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

export function ConfirmActionDialog({ open, pending = false, title = "Confirm action", message, confirmLabel, tone = "warning", confirmType = "button", onCancel, onConfirm }: {
  open: boolean;
  pending?: boolean;
  title?: string;
  message: string;
  confirmLabel: React.ReactNode;
  tone?: "warning" | "danger";
  confirmType?: "button" | "submit";
  onCancel: () => void;
  onConfirm?: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const dialog = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    cancelButton.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, pending]);

  if (!open) return null;
  const danger = tone === "danger";

  return <div className="fixed inset-0 z-[110] grid place-items-center bg-[#071127]/65 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
    <section ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} className="w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${danger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{danger ? <Trash2 size={23} aria-hidden="true" /> : <AlertTriangle size={23} aria-hidden="true" />}</span>
        <button ref={cancelButton} type="button" disabled={pending} onClick={onCancel} aria-label="Close confirmation" className="grid size-10 place-items-center rounded-xl border border-[#D7E0E9] text-[#586575] transition hover:border-[#1974E2] hover:text-[#1974E2] disabled:opacity-50"><X size={18} aria-hidden="true" /></button>
      </div>
      <h2 id={titleId} className="mt-5 text-2xl font-extrabold text-[#071127]">{title}</h2>
      <p id={messageId} className="mt-3 text-sm leading-6 text-[#586575]">{message}</p>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-xl border border-[#C9D5E2] bg-white px-5 text-sm font-extrabold text-[#263446] hover:bg-[#F4F7FA] disabled:opacity-50">Cancel</button>
        <button type={confirmType} disabled={pending} onClick={onConfirm} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-white disabled:opacity-60 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-[#1974E2] hover:bg-[#145EBA]"}`}>
          {pending && <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />}{pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </section>
  </div>;
}
