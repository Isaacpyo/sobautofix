import { CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoadFailedNotice, NotPermitted, SchemaMissingNotice } from "@/components/admin/diary/diary-states";
import { DiaryToolbar } from "@/components/admin/diary/diary-toolbar";
import { AgendaView, DiaryLegend, MonthView, TimeGridView } from "@/components/admin/diary/diary-views";
import { hoursConfigured, parseWeeklyHours } from "@/lib/diary/hours";
import { filterEntries } from "@/lib/diary/mapping";
import { diaryHref, parseDiaryParams } from "@/lib/diary/params";
import { loadDiaryEntries, loadStaffDirectory, staffNameMap } from "@/lib/diary/repository";
import { diaryRange, rangeTitle, shiftDiaryDate, todayInLondon, type DiaryView } from "@/lib/diary/time";
import { requireStaffPage } from "@/lib/exchange/staff";
import { getSiteSettings } from "@/lib/settings/repository";

export const metadata: Metadata = { title: "Autofix Diary" };

export default async function DiaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff, allowed } = await requireStaffPage("diary.manage");
  if (!allowed) return <NotPermitted what="the diary" />;

  const today = todayInLondon();
  const state = parseDiaryParams(await searchParams, today);
  // Without a chosen view, phones get the agenda and larger screens the week.
  const views: DiaryView[] = state.view ? [state.view] : ["agenda", "week"];
  const ranges = views.map((view) => diaryRange(view, state.date));
  const startUtc = ranges.map((range) => range.startUtc).sort()[0] as string;
  const endUtc = ranges.map((range) => range.endUtc).sort().at(-1) as string;

  const [directory, site] = await Promise.all([loadStaffDirectory(staff.client), getSiteSettings()]);
  const openingHours = parseWeeklyHours(site.openingHours as Record<string, string>);
  const result = await loadDiaryEntries(staff.client, startUtc, endUtc, staff.role, staffNameMap(directory));
  const entries = filterEntries(result.entries, state);

  const pagingView: DiaryView = state.view ?? "week";
  const titleRange = diaryRange(state.view ?? "agenda", state.date);
  const viewLinks = Object.fromEntries((["day", "week", "month", "agenda"] as const).map((view) => [view, diaryHref(state, { view })])) as Record<DiaryView, string>;
  const dayHref = (date: string) => diaryHref(state, { view: "day", date });
  const newHref = (date: string) => `/admin/diary/new?start=${date}T09:00`;

  return (
    <div className="mx-auto grid grid-cols-1 max-w-[1400px] gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF2FD] text-[#1974E2] sm:grid"><CalendarDays size={23} aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-extrabold tracking-widest text-[#1462C4] uppercase">Operations</p>
            <h1 className="mt-1 text-3xl font-extrabold text-[#0B1220] sm:text-4xl">Autofix Diary</h1>
            <p className="mt-1 hidden max-w-2xl text-sm text-[#5B6575] sm:block sm:text-base">Workshop bookings, viewings, inspections, preparation, collections and handovers in one place. Times are UK time.</p>
          </div>
        </div>
        <Link href={`/admin/diary/new?start=${state.date}T09:00`} className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#1974E2] px-4 sm:inline-flex text-sm font-bold text-white hover:bg-[#1462C4] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]">
          <Plus size={18} aria-hidden="true" /> New appointment
        </Link>
      </header>

      {result.schemaMissing && <SchemaMissingNotice />}
      {result.failed && <LoadFailedNotice />}

      <DiaryToolbar
        view={state.view}
        date={state.date}
        title={rangeTitle(state.view ? titleRange : diaryRange("week", state.date))}
        mobileTitle={state.view ? undefined : rangeTitle(diaryRange("agenda", state.date))}
        filters={{ type: state.type, staff: state.staff, status: state.status }}
        staff={directory.map((member) => ({ id: member.id, name: member.name }))}
        links={{
          previous: diaryHref(state, { date: shiftDiaryDate(pagingView, state.date, -1) }),
          today: diaryHref(state, { date: today }),
          next: diaryHref(state, { date: shiftDiaryDate(pagingView, state.date, 1) }),
          clear: diaryHref(state, { type: "", staff: "", status: "" }),
          views: viewLinks,
        }}
      />

      {state.view !== "agenda" && <div className={state.view ? undefined : "hidden lg:block"}><DiaryLegend showHours={hoursConfigured(openingHours)} /></div>}

      {(state.view === "agenda" || !state.view) && (
        <div className={state.view ? undefined : "lg:hidden"}>
          <AgendaView range={diaryRange("agenda", state.date)} entries={entries} today={today} newHref={newHref} />
        </div>
      )}
      {(state.view === "week" || !state.view) && (
        <div className={state.view ? undefined : "hidden lg:block"}>
          <TimeGridView range={diaryRange("week", state.date)} entries={entries} today={today} dayHref={dayHref} newHref={newHref} openingHours={openingHours} />
        </div>
      )}
      {state.view === "day" && (
        <>
          <div className="hidden sm:block"><TimeGridView range={diaryRange("day", state.date)} entries={entries} today={today} dayHref={dayHref} newHref={newHref} openingHours={openingHours} /></div>
          <div className="sm:hidden"><AgendaView range={diaryRange("day", state.date)} entries={entries} today={today} newHref={newHref} /></div>
        </>
      )}
      {state.view === "month" && <MonthView range={diaryRange("month", state.date)} entries={entries} today={today} dayHref={dayHref} />}

      {!entries.length && !result.failed && (
        <p className="text-sm text-[#5B6575]" role="status">{result.entries.length ? "No appointments match these filters." : "No appointments in this period."}</p>
      )}
    </div>
  );
}
