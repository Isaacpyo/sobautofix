// Positions diary entries on a day column (day and week views) and groups
// them by London calendar date (agenda and month views). Positions use the
// London wall clock, so on clock-change days an 09:00 entry still sits at
// 09:00 even though the day is 23 or 25 hours long.

import { addDays, londonDateKey, londonMidnight, londonMinutesOfDay } from "./time";
import type { DiaryEntry } from "./types";

export type PositionedEntry = {
  entry: DiaryEntry;
  /** Minutes since local midnight, clipped to the day. */
  top: number;
  bottom: number;
  column: number;
  columns: number;
  /** The entry started before or ends after this day. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

const MIN_HEIGHT_MINUTES = 20;

/** Entries that touch a London calendar date. */
export function entriesOnDate(entries: DiaryEntry[], date: string) {
  const dayStart = londonMidnight(date).getTime();
  const dayEnd = londonMidnight(addDays(date, 1)).getTime();
  return entries.filter((entry) => Date.parse(entry.start) < dayEnd && Date.parse(entry.end) > dayStart);
}

/** Groups entries by the London date they start on (agenda and month views). */
export function groupByStartDate(entries: DiaryEntry[]) {
  const groups = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const key = londonDateKey(entry.start);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return groups;
}

export function layoutDay(entries: DiaryEntry[], date: string): PositionedEntry[] {
  const dayStart = londonMidnight(date).getTime();
  const dayEnd = londonMidnight(addDays(date, 1)).getTime();
  const placed = entriesOnDate(entries, date)
    .map((entry) => {
      const start = Date.parse(entry.start);
      const end = Date.parse(entry.end);
      const continuesBefore = start < dayStart;
      const continuesAfter = end > dayEnd;
      const top = continuesBefore ? 0 : londonMinutesOfDay(start);
      let bottom = continuesAfter ? 24 * 60 : londonMinutesOfDay(end);
      if (!continuesAfter && bottom === 0 && end > start) bottom = 24 * 60;
      bottom = Math.max(bottom, top + MIN_HEIGHT_MINUTES);
      return { entry, top, bottom, column: 0, columns: 1, continuesBefore, continuesAfter };
    })
    .sort((left, right) => left.top - right.top || right.bottom - left.bottom || left.entry.key.localeCompare(right.entry.key));

  // Cluster entries that overlap (directly or through a chain) and give each
  // one the first free column inside its cluster.
  let cluster: PositionedEntry[] = [];
  let clusterEnd = -1;
  const finish = () => {
    const columns = Math.max(1, ...cluster.map((item) => item.column + 1));
    for (const item of cluster) item.columns = columns;
    cluster = [];
  };
  for (const item of placed) {
    if (item.top >= clusterEnd && cluster.length) finish();
    const used = new Set(cluster.filter((other) => other.bottom > item.top).map((other) => other.column));
    let column = 0;
    while (used.has(column)) column += 1;
    item.column = column;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.bottom);
  }
  if (cluster.length) finish();
  return placed;
}

/** First and last whole hours to draw: working hours, widened to fit every entry. */
export function visibleHours(positioned: PositionedEntry[], defaults: { from: number; to: number } = { from: 7, to: 19 }) {
  let from = defaults.from;
  let to = defaults.to;
  for (const item of positioned) {
    from = Math.min(from, Math.floor(item.top / 60));
    to = Math.max(to, Math.ceil(item.bottom / 60));
  }
  return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 1)) };
}
