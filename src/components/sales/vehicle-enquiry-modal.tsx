"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EnquiryForm } from "@/components/forms/enquiry-form";

export function VehicleEnquiryModal({ vehicleSlug, vehicleName }: { vehicleSlug: string; vehicleName: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center rounded-xl bg-[#1974E2] px-5 font-bold text-white transition hover:bg-[#145CAD] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/30">
        Arrange a viewing
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#071127]/70 p-2 backdrop-blur-sm sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="vehicle-enquiry-title" aria-describedby="vehicle-enquiry-vehicle" className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-3 sm:gap-5">
              <div>
                <p className="text-xs font-bold tracking-[.16em] text-[#1974E2] uppercase">Vehicle enquiry</p>
                <h2 id="vehicle-enquiry-title" className="mt-2 text-xl font-extrabold text-[#071127] sm:text-2xl">Arrange a viewing or ask a question</h2>
                <p id="vehicle-enquiry-vehicle" className="mt-2 text-sm text-[#586575]">{vehicleName}</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-full text-[#586575] transition hover:bg-[#F4F7FA] hover:text-[#071127] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/25" aria-label="Close vehicle enquiry form"><X size={20} aria-hidden="true" /></button>
            </div>
            <div className="mt-5"><EnquiryForm type="vehicle_sales" title="" defaultService={vehicleSlug} compact /></div>
          </section>
        </div>
      )}
    </>
  );
}
