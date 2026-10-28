// Serializable result of a diary form action, shared by the diary and the
// Viewings page. Kept out of the "use server" files so only real actions are
// exposed as endpoints.

import { conflictReasonLabels, type DiaryConflict } from "./conflicts";
import type { EmailOutcome } from "./notifications";
import type { ServiceResult } from "./service";
import { formatDateKeyShort, formatLondonTimeRange, londonDateKey } from "./time";
import { diaryTypeLabels } from "./types";

export type ConflictView = { key: string; reason: string; reasons: string[]; title: string; type: string; when: string; staff: string | null; vehicle: string | null; href: string; status: string };

export type DiaryFormState = {
  status: "idle" | "error" | "conflict" | "stale" | "saved";
  message?: string;
  fieldErrors?: Record<string, string>;
  conflicts?: ConflictView[];
  signature?: string;
  email?: EmailOutcome;
};

/** One row per clashing entry, listing every reason it clashes. */
export function conflictViews(conflicts: DiaryConflict[]): ConflictView[] {
  const views = new Map<string, ConflictView>();
  for (const conflict of conflicts) {
    const existing = views.get(conflict.entry.key);
    const reason = conflictReasonLabels[conflict.reason];
    if (existing) {
      existing.reasons.push(reason);
      existing.reason = existing.reasons.join(" and ").replace(/ and (\w)/g, (_, letter: string) => ` and ${letter.toLowerCase()}`);
      continue;
    }
    views.set(conflict.entry.key, {
      key: conflict.entry.key,
      reason,
      reasons: [reason],
      title: conflict.entry.title,
      type: diaryTypeLabels[conflict.entry.type],
      when: `${formatDateKeyShort(londonDateKey(conflict.entry.start))}, ${formatLondonTimeRange(conflict.entry.start, conflict.entry.end)}`,
      staff: conflict.entry.assignedName,
      vehicle: conflict.entry.vehicleLabel,
      href: conflict.entry.href,
      status: conflict.entry.statusLabel,
    });
  }
  return [...views.values()];
}

export function toFormState(result: ServiceResult): DiaryFormState {
  if (result.ok) return { status: "saved", message: result.message, email: result.email };
  if (result.kind === "conflict") {
    const views = conflictViews(result.conflicts);
    if (result.outsideHours) views.push({ key: "outside_hours", reason: "Outside opening hours", reasons: ["Outside opening hours"], title: `Open ${result.outsideHours.open} to ${result.outsideHours.close} that day`, type: "Opening hours", when: "Set in Settings", staff: null, vehicle: null, href: "/admin/settings", status: "Settings" });
    return { status: "conflict", message: result.message, conflicts: views, signature: result.signature, fieldErrors: result.fieldErrors };
  }
  if (result.kind === "stale") return { status: "stale", message: result.message };
  if (result.kind === "invalid") return { status: "error", message: result.message, fieldErrors: result.fieldErrors };
  return { status: "error", message: result.message };
}

