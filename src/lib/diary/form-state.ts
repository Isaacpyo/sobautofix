// Serializable result of a diary form action, shared by the diary and the
// Viewings page. Kept out of the "use server" files so only real actions are
// exposed as endpoints.

import { conflictReasonLabels, type DiaryConflict } from "./conflicts";
import type { EmailOutcome } from "./notifications";
import type { ServiceResult } from "./service";
import { formatDateKeyShort, formatLondonTimeRange, londonDateKey } from "./time";
import { diaryTypeLabels } from "./types";

export type ConflictView = { key: string; reason: string; title: string; type: string; when: string; staff: string | null; vehicle: string | null; href: string; status: string };

export type DiaryFormState = {
  status: "idle" | "error" | "conflict" | "saved";
  message?: string;
  fieldErrors?: Record<string, string>;
  conflicts?: ConflictView[];
  signature?: string;
  email?: EmailOutcome;
};

function conflictView(conflict: DiaryConflict): ConflictView {
  return {
    key: conflict.key,
    reason: conflictReasonLabels[conflict.reason],
    title: conflict.entry.title,
    type: diaryTypeLabels[conflict.entry.type],
    when: `${formatDateKeyShort(londonDateKey(conflict.entry.start))}, ${formatLondonTimeRange(conflict.entry.start, conflict.entry.end)}`,
    staff: conflict.entry.assignedName,
    vehicle: conflict.entry.vehicleLabel,
    href: conflict.entry.href,
    status: conflict.entry.statusLabel,
  };
}

export function toFormState(result: ServiceResult): DiaryFormState {
  if (result.ok) return { status: "saved", message: result.message, email: result.email };
  if (result.kind === "conflict") return { status: "conflict", message: result.message, conflicts: result.conflicts.map(conflictView), signature: result.signature };
  if (result.kind === "invalid") return { status: "error", message: result.message, fieldErrors: result.fieldErrors };
  return { status: "error", message: result.message };
}

