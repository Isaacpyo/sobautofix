"use client";

import { FilePenLine, X } from "lucide-react";
import { useState } from "react";
import { AdminLoadingLink } from "@/components/admin/admin-loading-link";

export type InvoiceDraftSummary = {
  id: string;
  customerName: string;
  serviceName: string;
  vehicleLabel: string;
  updatedLabel: string;
};

export function InvoiceDraftsWorkspace({ header, children, drafts }: { header: React.ReactNode; children: React.ReactNode; drafts: InvoiceDraftSummary[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">{header}</div>
      <button type="button" aria-expanded={isOpen} aria-controls="invoice-drafts-panel" onClick={() => setIsOpen((open) => !open)} className="mt-5 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#BCD6F6] bg-white px-4 text-sm font-extrabold text-[#1446A5] shadow-sm transition hover:border-[#1974E2] hover:bg-[#F1F7FF]">
        <FilePenLine size={18} aria-hidden="true" /> Draft invoices
        <span className="rounded-full bg-[#EAF3FF] px-2 py-0.5 text-xs text-[#1974E2]">{drafts.length}</span>
      </button>
    </div>

    <div className={isOpen ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}>
      <div className="min-w-0">{children}</div>
      {isOpen && <aside id="invoice-drafts-panel" aria-label="Draft invoices" className="mt-6 rounded-2xl border border-[#BCD6F6] bg-[#F6FAFF] p-4 shadow-lg xl:sticky xl:top-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#D7E5F5] pb-3">
          <div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Saved work</p><h2 className="mt-1 text-xl font-extrabold text-[#071127]">Draft invoices</h2></div>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close draft invoices" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#D7E0E9] bg-white text-[#586575] transition hover:border-[#1974E2] hover:text-[#1974E2]"><X size={18} aria-hidden="true" /></button>
        </div>
        {drafts.length ? <div className="mt-3 grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
          {drafts.map((draft) => <article key={draft.id} className="rounded-xl border border-[#DCE7F2] bg-white p-4">
            <h3 className="font-extrabold text-[#071127]">{draft.customerName}</h3>
            <p className="mt-1 text-sm font-semibold text-[#586575]">{draft.serviceName}</p>
            <p className="mt-1 text-xs text-[#667586]">{draft.vehicleLabel}</p>
            <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-[#667586]">Updated {draft.updatedLabel}</span><AdminLoadingLink href={`/admin/invoices/${draft.id}/edit`} className="inline-flex min-h-9 items-center rounded-lg bg-[#1974E2] px-3 text-xs font-extrabold text-white hover:bg-[#145EBA]" loadingTitle="Opening draft" loadingDescription="Please wait while the draft invoice opens.">Resume</AdminLoadingLink></div>
          </article>)}
        </div> : <p className="mt-4 rounded-xl border border-dashed border-[#BCD6F6] bg-white p-5 text-center text-sm text-[#667586]">There are no saved draft invoices.</p>}
      </aside>}
    </div>
  </>;
}
