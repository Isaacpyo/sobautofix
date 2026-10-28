// Conflict warnings for diary appointments. These warn, they never block:
// staff can save after acknowledging, because two people at a viewing or a
// quick handover during a booking can be perfectly fine.

import type { DiaryEntry } from "./types";

export type ConflictCandidate = {
  /** The appointment being edited, so it never conflicts with itself. */
  id?: string | null;
  kind: string;
  start: string;
  end: string;
  assignedTo?: string | null;
  saleVehicleId?: string | null;
};

export type ConflictReason = "same_staff" | "same_vehicle" | "same_viewing_slot";

export type DiaryConflict = {
  key: string;
  reason: ConflictReason;
  entry: Pick<DiaryEntry, "key" | "id" | "type" | "title" | "start" | "end" | "assignedName" | "vehicleLabel" | "href" | "statusLabel">;
};

export const conflictReasonLabels: Record<ConflictReason, string> = {
  same_staff: "Same staff member",
  same_vehicle: "Same vehicle",
  same_viewing_slot: "Another viewing at this time",
};

export function overlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return Date.parse(leftStart) < Date.parse(rightEnd) && Date.parse(rightStart) < Date.parse(leftEnd);
}

/**
 * Entries that clash with the candidate. Cancelled and no-show entries never
 * clash. One entry can produce more than one reason (for example the same
 * person and the same car); each reason is reported once.
 */
export function detectConflicts(candidate: ConflictCandidate, entries: DiaryEntry[]): DiaryConflict[] {
  const conflicts: DiaryConflict[] = [];
  for (const entry of entries) {
    if (entry.source === "appointment" && candidate.id && entry.id === candidate.id) continue;
    if (entry.status === "cancelled" || entry.status === "no_show") continue;
    if (!overlaps(candidate.start, candidate.end, entry.start, entry.end)) continue;
    const summary = {
      key: entry.key,
      id: entry.id,
      type: entry.type,
      title: entry.title,
      start: entry.start,
      end: entry.end,
      assignedName: entry.assignedName,
      vehicleLabel: entry.vehicleLabel,
      href: entry.href,
      statusLabel: entry.statusLabel,
    };
    if (candidate.assignedTo && entry.assignedTo === candidate.assignedTo) conflicts.push({ key: `${entry.key}:same_staff`, reason: "same_staff", entry: summary });
    if (candidate.saleVehicleId && entry.saleVehicleId === candidate.saleVehicleId) conflicts.push({ key: `${entry.key}:same_vehicle`, reason: "same_vehicle", entry: summary });
    if (candidate.kind === "viewing" && entry.type === "viewing") conflicts.push({ key: `${entry.key}:same_viewing_slot`, reason: "same_viewing_slot", entry: summary });
  }
  return conflicts.sort((left, right) => Date.parse(left.entry.start) - Date.parse(right.entry.start) || left.key.localeCompare(right.key));
}

/**
 * A stable fingerprint of a set of conflicts. The form sends back the
 * fingerprint the person acknowledged; if the clashes have changed since
 * (someone else booked the slot meanwhile), they are warned again.
 */
export function conflictSignature(conflicts: DiaryConflict[]) {
  return conflicts.map((conflict) => conflict.key).sort().join("|");
}
