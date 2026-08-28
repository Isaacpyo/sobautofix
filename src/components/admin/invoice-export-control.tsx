"use client";

import { Download } from "lucide-react";
import { useState } from "react";

const field = "mt-2 block min-h-11 w-full rounded-xl border border-[#D7E0E9] bg-white px-3 text-sm font-semibold text-[#071127]";
const label = "text-xs font-extrabold tracking-wide text-[#667586] uppercase";

export function InvoiceExportControl() {
  const now = new Date();
  const [period, setPeriod] = useState("month");
  return <details className="relative">
    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-[#C9D5E2] bg-white px-5 text-sm font-extrabold text-[#1446A5] marker:hidden"><Download size={18} /> Export invoices</summary>
    <div className="absolute right-0 z-20 mt-3 w-[min(92vw,38rem)] rounded-2xl border border-[#D7E0E9] bg-white p-5 shadow-xl">
      <h2 className="text-xl font-extrabold text-[#071127]">Export invoices</h2>
      <p className="mt-1 text-sm text-[#667586]">Choose a reporting period and the invoice categories to include.</p>
      <form method="get" action="/api/admin/invoices/export" target="_blank" className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={label}>Period<select name="period" value={period} onChange={(event) => setPeriod(event.target.value)} className={field}><option value="all">All time</option><option value="date">Single date</option><option value="month">Month</option><option value="year">Year</option><option value="custom">Custom date range</option></select></label>
        {period === "date" && <label className={label}>Date<input type="date" name="date" required className={field} /></label>}
        {period === "month" && <label className={label}>Month<input type="month" name="month" required defaultValue={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`} className={field} /></label>}
        {period === "year" && <label className={label}>Year<input type="number" name="year" required min="2020" max="9999" defaultValue={now.getFullYear()} className={field} /></label>}
        {period === "custom" && <><label className={label}>From<input type="date" name="start" required className={field} /></label><label className={label}>To<input type="date" name="end" required className={field} /></label></>}
        <label className={label}>Status<select name="status" className={field}><option value="">All statuses</option><option value="draft">Draft</option><option value="issued">Unpaid</option><option value="paid">Paid / Settled</option><option value="void">Void</option></select></label>
        <label className={label}>Source category<select name="source" className={field}><option value="">All sources</option><option value="booking">Booking</option><option value="enquiry">Enquiry</option><option value="manual">Manual</option></select></label>
        <label className={label}>File format<select name="format" className={field}><option value="pdf">PDF report</option><option value="csv">CSV spreadsheet</option></select></label>
        <button className="min-h-11 self-end rounded-xl bg-[#071127] px-5 text-sm font-extrabold text-white">Download export</button>
      </form>
    </div>
  </details>;
}
