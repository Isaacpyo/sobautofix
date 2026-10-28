import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { DiaryEntryCard, StatusBadge } from "@/components/admin/diary/diary-badges";
import { GridScroller } from "@/components/admin/diary/grid-scroller";
import { gridHours, hoursConfigured, type DayHours, type WeeklyHours } from "@/lib/diary/hours";
import { entriesOnDate, groupByStartDate, layoutDay, visibleHours, type PositionedEntry } from "@/lib/diary/layout";
import { dateKeysInRange, formatDateKeyLong, londonDayLengthHours, londonTimeKey, weekdayIndex, type DiaryRange } from "@/lib/diary/time";
import { diaryTypeLabels, diaryTypeStyles, type DiaryEntry } from "@/lib/diary/types";
import { cn } from "@/lib/utils";

const weekdayShort = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const dayNumber = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

function noon(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

export type DiaryHrefBuilder = (changes: { view?: string; date?: string }) => string;

function ClockChangeNote({ date }: { date: string }) {
  const hours = londonDayLengthHours(date);
  if (hours === 24) return null;
  return (
    <p className="mt-1 text-xs font-semibold text-[#93370D]">
      {hours === 23 ? "Clocks go forward at 01:00 (23-hour day)" : "Clocks go back at 02:00 (25-hour day)"}
    </p>
  );
}

/** Phone-first list: one section per day, every day shown so gaps are obvious. */
export function AgendaView({ range, entries, today, newHref }: { range: DiaryRange; entries: DiaryEntry[]; today: string; newHref: (date: string) => string }) {
  const days = dateKeysInRange(range.date, range.end);
  const groups = groupByStartDate(entries);
  return (
    <ol className="grid grid-cols-1 gap-5" aria-label="Agenda">
      {days.map((date) => {
        const items = groups.get(date) ?? [];
        return (
          <li key={date} aria-labelledby={`agenda-${date}`}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id={`agenda-${date}`} className="text-base font-extrabold text-[#0B1220]">
                  {formatDateKeyLong(date)}
                  {date === today && <span className="ml-2 rounded-full bg-[#1974E2] px-2 py-0.5 align-middle text-xs font-bold text-white">Today</span>}
                </h2>
                <ClockChangeNote date={date} />
              </div>
              <Link href={newHref(date)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-[#1462C4] hover:bg-[#EAF2FD] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]">
                <CalendarPlus size={17} aria-hidden="true" /> Add<span className="sr-only"> an appointment on {formatDateKeyLong(date)}</span>
              </Link>
            </div>
            {items.length ? (
              <ul className="mt-2 grid grid-cols-1 gap-3">
                {items.map((entry) => <li key={entry.key}><DiaryEntryCard entry={entry} /></li>)}
              </ul>
            ) : (
              <p className="mt-2 rounded-2xl border border-dashed border-[#D0D5DD] px-4 py-3 text-sm text-[#5B6575]">Nothing booked.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const HOUR_HEIGHT = 56;

/** Day and week views: hour rows with entries placed by London wall-clock time. */
export function TimeGridView({ range, entries, today, dayHref, newHref, openingHours }: { range: DiaryRange; entries: DiaryEntry[]; today: string; dayHref: (date: string) => string; newHref: (date: string) => string; openingHours: WeeklyHours }) {
  const days = dateKeysInRange(range.start, range.end);
  const layouts = new Map(days.map((date) => [date, layoutDay(entries, date)]));
  const positioned = [...layouts.values()].flat();
  // Configured opening hours set the span; without them the day is shown in full.
  const { from, to } = visibleHours(positioned, gridHours(openingHours));
  const hours = Array.from({ length: to - from }, (_, index) => from + index);
  const single = days.length === 1;
  const firstMinute = positioned.length ? Math.min(...positioned.map((item) => item.top)) : null;
  const startAt = firstMinute !== null ? Math.max(from * 60, firstMinute - 30) : hoursConfigured(openingHours) ? from * 60 : 7 * 60;

  return (
    <GridScroller initialTop={((startAt - from * 60) / 60) * HOUR_HEIGHT} label={single ? "Day timetable" : "Week timetable"} className="max-h-[calc(100vh-14rem)] min-h-80 overflow-auto overscroll-contain rounded-2xl border border-[#E3E8EF] bg-white">
      <div className={cn("grid", single ? "min-w-[320px] grid-cols-[56px_minmax(0,1fr)]" : "min-w-[880px] grid-cols-[56px_repeat(7,minmax(0,1fr))]")}>
        <div className="sticky top-0 z-10 border-b border-[#E3E8EF] bg-white" />
        {days.map((date) => (
          <div key={date} className={cn("sticky top-0 z-10 border-b border-l border-[#E3E8EF] bg-white px-2 py-2", date === today && "bg-[#F5F9FF]")}>
            {single ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-[#0B1220]">{formatDateKeyLong(date)}</p>
                  <ClockChangeNote date={date} />
                </div>
                <Link href={newHref(date)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-[#1462C4] hover:bg-[#EAF2FD] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]"><CalendarPlus size={17} aria-hidden="true" /> Add</Link>
              </div>
            ) : (
              <Link href={dayHref(date)} className="block rounded-lg px-1 py-0.5 text-center hover:bg-[#EAF2FD] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]" aria-label={`${formatDateKeyLong(date)}: open day view`}>
                <span className="block text-xs font-semibold text-[#5B6575]">{weekdayShort.format(noon(date))}</span>
                <span className={cn("mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-base font-extrabold", date === today ? "bg-[#1974E2] text-white" : "text-[#0B1220]")}>{dayNumber.format(noon(date))}</span>
                {londonDayLengthHours(date) !== 24 && <span className="mt-0.5 block text-[10px] font-bold text-[#93370D]">{londonDayLengthHours(date) === 23 ? "Clocks forward" : "Clocks back"}</span>}
              </Link>
            )}
          </div>
        ))}

        <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }} aria-hidden="true">
          {hours.map((hour, index) => (
            <span key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-[#5B6575]" style={{ top: index * HOUR_HEIGHT }}>
              {index === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
        {days.map((date) => (
          <DayColumn key={date} date={date} positioned={layouts.get(date) ?? []} from={from} hours={hours.length} today={date === today} compact={!single} dayHours={openingHours[weekdayIndex(date)] ?? null} />
        ))}
      </div>
    </GridScroller>
  );
}

function minutesOf(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function DayColumn({ date, positioned, from, hours, today, compact, dayHours }: { date: string; positioned: PositionedEntry[]; from: number; hours: number; today: boolean; compact: boolean; dayHours: DayHours }) {
  const toPx = (minute: number) => ((minute - from * 60) / 60) * HOUR_HEIGHT;
  return (
    <section className={cn("relative border-l border-[#E3E8EF]", today && "bg-[#F5F9FF]")} style={{ height: hours * HOUR_HEIGHT }} aria-label={formatDateKeyLong(date)}>
      {dayHours && (
        <>
          <div className="absolute inset-x-0 top-0 bg-[#F2F4F7]" style={{ height: Math.max(0, toPx(minutesOf(dayHours.open))) }} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 bg-[#F2F4F7]" style={{ top: Math.max(0, toPx(minutesOf(dayHours.close))) }} aria-hidden="true" />
        </>
      )}
      {Array.from({ length: hours }, (_, index) => <div key={index} className="absolute inset-x-0 border-t border-[#EEF2F6]" style={{ top: index * HOUR_HEIGHT }} aria-hidden="true" />)}
      {!positioned.length && <p className="sr-only">Nothing booked.</p>}
      <ul>
        {positioned.map((item) => {
          const style = diaryTypeStyles[item.entry.type];
          const top = ((item.top - from * 60) / 60) * HOUR_HEIGHT;
          const height = Math.max(26, ((item.bottom - item.top) / 60) * HOUR_HEIGHT - 2);
          const width = 100 / item.columns;
          const cancelled = item.entry.status === "cancelled" || item.entry.status === "no_show";
          const requested = item.entry.status === "requested";
          return (
            <li key={item.entry.key} className="absolute px-0.5" style={{ top: Math.max(0, top) + 1, height, left: `${item.column * width}%`, width: `${width}%` }}>
              <Link
                href={item.entry.href}
                className={cn("flex h-full flex-col overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left shadow-[0_1px_2px_rgba(16,24,40,.06)] hover:brightness-[.97] focus-visible:z-20 focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)] motion-reduce:transition-none", cancelled && "opacity-70", requested && "border-y border-r border-dashed")}
                style={requested
                  ? { borderLeftColor: style.edge, borderTopColor: style.edge, borderRightColor: style.edge, borderBottomColor: style.edge, borderLeftStyle: "dashed", backgroundColor: "#FFFFFF", backgroundImage: `repeating-linear-gradient(135deg, ${style.fill} 0 6px, #FFFFFF 6px 12px)`, color: style.text }
                  : { borderLeftColor: style.edge, backgroundColor: style.fill, color: style.text }}
              >
                <span className="text-[11px] leading-tight font-bold">
                  {item.continuesBefore ? "…" : londonTimeKey(item.entry.start)} {requested ? `${item.entry.source === "booking" ? "Pending" : "Requested"} ${diaryTypeLabels[item.entry.type].toLowerCase()}` : diaryTypeLabels[item.entry.type]}
                </span>
                <span className={cn("text-xs leading-tight font-extrabold", cancelled && "line-through")}>{item.entry.title}</span>
                {!compact || height > 60 ? (
                  <span className="mt-0.5 text-[11px] leading-tight">
                    {[item.entry.vehicleLabel, item.entry.customerName, item.entry.assignedName].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                {(!compact || height > 84) && <span className="mt-auto pt-0.5"><StatusBadge status={item.entry.status} label={item.entry.statusLabel} className="px-1.5 py-0 text-[10px]" /></span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Month grid: whole weeks, up to three entries a day, then a link to the day. */
export function MonthView({ range, entries, today, dayHref }: { range: DiaryRange; entries: DiaryEntry[]; today: string; dayHref: (date: string) => string }) {
  const days = dateKeysInRange(range.start, range.end);
  const month = range.date.slice(0, 7);
  const headings = days.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white">
      <div className="grid grid-cols-7 border-b border-[#E3E8EF] bg-[#F8FAFC]" aria-hidden="true">
        {headings.map((date) => <div key={date} className="px-2 py-2 text-center text-xs font-bold text-[#5B6575]">{weekdayShort.format(noon(date))}</div>)}
      </div>
      <ol className="grid grid-cols-7">
        {days.map((date) => {
          const items = entriesOnDate(entries, date);
          const outside = date.slice(0, 7) !== month;
          const shown = items.slice(0, 3);
          return (
            <li key={date} className={cn("min-h-16 border-b border-l border-[#EEF2F6] p-1 first:border-l-0 sm:min-h-28 sm:p-1.5 [&:nth-child(7n+1)]:border-l-0", outside && "bg-[#F8FAFC]")}>
              <Link href={dayHref(date)} className="flex min-h-11 items-start justify-between gap-1 rounded-lg px-1 pt-1 hover:bg-[#EAF2FD] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)] sm:min-h-0" aria-label={`${formatDateKeyLong(date)}: ${items.length ? `${items.length} ${items.length === 1 ? "entry" : "entries"}` : "nothing booked"}`}>
                <span className={cn("grid size-7 place-items-center rounded-full text-sm font-extrabold", date === today ? "bg-[#1974E2] text-white" : outside ? "text-[#5B6575]" : "text-[#0B1220]")}>{dayNumber.format(noon(date))}</span>
                {items.length > 0 && <span className="mt-1 rounded-full bg-[#EAF2FD] px-1.5 text-[11px] font-bold text-[#0B3B7A] sm:hidden">{items.length}</span>}
              </Link>
              <ul className="mt-1 hidden gap-1 sm:grid">
                {shown.map((entry) => {
                  const style = diaryTypeStyles[entry.type];
                  return (
                    <li key={entry.key}>
                      <Link href={entry.href} className={cn("block truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight font-semibold hover:brightness-[.97] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]", entry.status === "requested" && "border border-dashed italic")} style={entry.status === "requested" ? { borderColor: style.edge, backgroundColor: "#FFFFFF", color: style.text } : { borderLeftColor: style.edge, backgroundColor: style.fill, color: style.text }}>
                        <span className="font-bold">{londonTimeKey(entry.start)}</span> <span className="sr-only">{diaryTypeLabels[entry.type]}{entry.status === "requested" ? ", requested, not confirmed" : ""}: </span>{entry.title}
                      </Link>
                    </li>
                  );
                })}
                {items.length > shown.length && (
                  <li><Link href={dayHref(date)} className="block rounded-md px-1.5 text-[11px] font-bold text-[#1462C4] hover:underline">+{items.length - shown.length} more<span className="sr-only"> on {dayMonth.format(noon(date))}</span></Link></li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function DiaryLegend({ showHours = false }: { showHours?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[#344054]" aria-label="Appointment types">
      {(Object.keys(diaryTypeLabels) as Array<keyof typeof diaryTypeLabels>).map((type) => (
        <li key={type} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: diaryTypeStyles[type].edge }} aria-hidden="true" />{diaryTypeLabels[type]}</li>
      ))}
      <li className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-dashed border-[#B54708]" style={{ backgroundImage: "repeating-linear-gradient(135deg, #FFFAEB 0 3px, #FFFFFF 3px 6px)" }} aria-hidden="true" />Dashed: requested, not yet confirmed</li>
      {showHours && <li className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-[#F2F4F7] ring-1 ring-[#D0D5DD]" aria-hidden="true" />Grey: outside opening hours</li>}
    </ul>
  );
}
