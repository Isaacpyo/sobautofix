"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRef, useState } from "react";
import { appointmentStatusLabels, appointmentStatuses, diaryEntryTypes, diaryTypeLabels } from "@/lib/diary/types";
import type { DiaryView } from "@/lib/diary/time";
import { cn } from "@/lib/utils";

export type DiaryToolbarProps = {
  /** null when no view was chosen: agenda on phones, week from lg up. */
  view: DiaryView | null;
  date: string;
  title: string;
  /** Title for phones when it differs (the default agenda starts on the chosen date). */
  mobileTitle?: string;
  filters: { type: string; staff: string; status: string };
  staff: Array<{ id: string; name: string }>;
  links: { previous: string; today: string; next: string; clear: string; views: Record<DiaryView, string> };
};

const viewLabels: Record<DiaryView, string> = { day: "Day", week: "Week", month: "Month", agenda: "Agenda" };
const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";
const fieldClass = "h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm text-[#0B1220] focus:border-[#1974E2] focus:outline-3 focus:outline-[rgba(22,139,255,.35)]";

function ViewSwitcher({ current, links, className }: { current: DiaryView; links: Record<DiaryView, string>; className?: string }) {
  return (
    <nav aria-label="Diary view" className={className}>
      <ul className="flex rounded-xl border border-[#D0D5DD] bg-white p-1">
        {(Object.keys(viewLabels) as DiaryView[]).map((view) => (
          <li key={view} className="flex-1">
            <Link href={links[view]} aria-current={view === current ? "page" : undefined} className={cn("flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-bold", view === current ? "bg-[#1974E2] text-white" : "text-[#344054] hover:bg-[#F3F5F8]", focusRing)}>
              {viewLabels[view]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DiaryToolbar({ view, date, title, mobileTitle, filters, staff, links }: DiaryToolbarProps) {
  const form = useRef<HTMLFormElement>(null);
  const activeFilters = [filters.type, filters.staff, filters.status].filter(Boolean).length;
  const [showFilters, setShowFilters] = useState(activeFilters > 0);
  const submit = () => form.current?.requestSubmit();

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={links.previous} aria-label="Previous" className={cn("grid size-11 place-items-center rounded-xl border border-[#D0D5DD] bg-white text-[#0B1220] hover:border-[#1974E2]", focusRing)}><ChevronLeft size={20} aria-hidden="true" /></Link>
          <Link href={links.today} className={cn("inline-flex min-h-11 items-center rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-bold text-[#0B1220] hover:border-[#1974E2]", focusRing)}>Today</Link>
          <Link href={links.next} aria-label="Next" className={cn("grid size-11 place-items-center rounded-xl border border-[#D0D5DD] bg-white text-[#0B1220] hover:border-[#1974E2]", focusRing)}><ChevronRight size={20} aria-hidden="true" /></Link>
          {mobileTitle ? (
            <>
              <p className="ml-1 text-base font-extrabold text-[#0B1220] sm:text-lg lg:hidden">{mobileTitle}</p>
              <p className="ml-1 hidden text-lg font-extrabold text-[#0B1220] lg:block">{title}</p>
            </>
          ) : (
            <p className="ml-1 text-base font-extrabold text-[#0B1220] sm:text-lg">{title}</p>
          )}
        </div>
        {view ? (
          <ViewSwitcher current={view} links={links.views} className="w-full sm:w-auto" />
        ) : (
          <>
            <ViewSwitcher current="agenda" links={links.views} className="w-full sm:w-auto lg:hidden" />
            <ViewSwitcher current="week" links={links.views} className="hidden lg:block" />
          </>
        )}
      </div>

      <Form ref={form} action="/admin/diary" className="rounded-2xl border border-[#E3E8EF] bg-white p-3" aria-label="Diary date and filters">
        {view && <input type="hidden" name="view" value={view} />}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10.5rem] flex-1 sm:flex-none">
            <label htmlFor="diary-date" className="mb-1 block text-xs font-bold text-[#344054]">Go to date</label>
            <input id="diary-date" type="date" name="date" defaultValue={date} onChange={(event) => { if (event.currentTarget.value) submit(); }} className={fieldClass} />
          </div>
          <button type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} aria-controls="diary-filters" className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D0D5DD] px-3 text-sm font-bold text-[#0B1220] hover:border-[#1974E2]", focusRing)}>
            <SlidersHorizontal size={17} aria-hidden="true" /> Filters{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          {activeFilters > 0 && <Link href={links.clear} className={cn("inline-flex min-h-11 items-center px-2 text-sm font-bold text-[#1462C4] hover:underline", focusRing)}>Clear filters</Link>}
          <noscript><button type="submit" className="min-h-11 rounded-xl bg-[#1974E2] px-4 text-sm font-bold text-white">Show</button></noscript>
        </div>
        <div id="diary-filters" hidden={!showFilters} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="diary-type" className="mb-1 block text-xs font-bold text-[#344054]">Type</label>
            <select id="diary-type" name="type" defaultValue={filters.type} onChange={submit} className={fieldClass}>
              <option value="">All types</option>
              {diaryEntryTypes.map((type) => <option key={type} value={type}>{diaryTypeLabels[type]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="diary-staff" className="mb-1 block text-xs font-bold text-[#344054]">Staff member</label>
            <select id="diary-staff" name="staff" defaultValue={filters.staff} onChange={submit} className={fieldClass}>
              <option value="">Everyone</option>
              <option value="unassigned">Unassigned</option>
              {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="diary-status" className="mb-1 block text-xs font-bold text-[#344054]">Status</label>
            <select id="diary-status" name="status" defaultValue={filters.status} onChange={submit} className={fieldClass}>
              <option value="">Any status</option>
              {appointmentStatuses.map((status) => <option key={status} value={status}>{appointmentStatusLabels[status]}</option>)}
            </select>
          </div>
        </div>
      </Form>
    </div>
  );
}
