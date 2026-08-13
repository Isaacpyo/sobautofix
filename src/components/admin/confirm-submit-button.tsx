"use client";

import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmSubmitButton({ children, message, className }: { children: React.ReactNode; message: string; className: string }) {
  const [open, setOpen] = useState(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButton.current?.focus();
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape" && !pending) setOpen(false); }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, pending]);

  return <>
    <button type="button" className={className} aria-hidden={open || undefined} tabIndex={open ? -1 : undefined} onClick={() => setOpen(true)}>{children}</button>
    {open && <div className="fixed inset-0 z-[110] grid place-items-center bg-[#071127]/65 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-message" className="w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800"><AlertTriangle size={23} aria-hidden="true" /></span>
          <button ref={cancelButton} type="button" disabled={pending} onClick={() => setOpen(false)} aria-label="Close confirmation" className="grid size-10 place-items-center rounded-xl border border-[#D7E0E9] text-[#586575] transition hover:border-[#1974E2] hover:text-[#1974E2] disabled:opacity-50"><X size={18} aria-hidden="true" /></button>
        </div>
        <h2 id="confirm-action-title" className="mt-5 text-2xl font-extrabold text-[#071127]">Confirm action</h2>
        <p id="confirm-action-message" className="mt-3 text-sm leading-6 text-[#586575]">{message}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={pending} onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-[#C9D5E2] bg-white px-5 text-sm font-extrabold text-[#263446] hover:bg-[#F4F7FA] disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1974E2] px-5 text-sm font-extrabold text-white hover:bg-[#145EBA] disabled:opacity-60">
            {pending && <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />}{pending ? "Working…" : children}
          </button>
        </div>
      </section>
    </div>}
  </>;
}
