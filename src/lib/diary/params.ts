// Reads and writes the diary URL: /admin/diary?view=&date=&type=&staff=&status=
// Only non-personal values go in the URL (a view, a date, a type, a staff id
// and a status). Anything unrecognised is ignored rather than trusted.

import { diaryViews, isDateKey, type DiaryView } from "./time";
import { isAppointmentStatus, isDiaryEntryType, type AppointmentStatus, type DiaryEntryType } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DiaryState = {
  /** null when the URL does not choose a view (agenda on phones, week on desktop). */
  view: DiaryView | null;
  date: string;
  type: DiaryEntryType | "";
  staff: string;
  status: AppointmentStatus | "";
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDiaryParams(params: RawParams, today: string): DiaryState {
  const view = first(params.view);
  const date = first(params.date);
  const type = first(params.type);
  const staff = first(params.staff);
  const status = first(params.status);
  return {
    view: diaryViews.includes(view as DiaryView) ? (view as DiaryView) : null,
    date: isDateKey(date) ? date : today,
    type: isDiaryEntryType(type) ? type : "",
    staff: staff === "unassigned" || (staff && UUID.test(staff)) ? staff : "",
    status: isAppointmentStatus(status) ? status : "",
  };
}

export function diaryHref(state: DiaryState, changes: Partial<DiaryState> = {}) {
  const next = { ...state, ...changes };
  const search = new URLSearchParams();
  if (next.view) search.set("view", next.view);
  search.set("date", next.date);
  if (next.type) search.set("type", next.type);
  if (next.staff) search.set("staff", next.staff);
  if (next.status) search.set("status", next.status);
  return `/admin/diary?${search.toString()}`;
}
