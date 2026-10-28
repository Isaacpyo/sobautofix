// Warnings shown before saving a diary change: clashes with other entries and,
// only when Settings has opening hours for that day, times outside them. The
// person can go ahead, but must acknowledge exactly these warnings and give a
// reason, which is stored on the appointment and in the audit log.

import { conflictSignature, type DiaryConflict } from "./conflicts";

export type OverrideInput = { acknowledged?: string | null; reason?: string | null };

export function warningSignature(conflicts: DiaryConflict[], outsideHours: { open: string; close: string } | null) {
  const parts = [conflictSignature(conflicts)];
  if (outsideHours) parts.push(`outside_hours:${outsideHours.open}-${outsideHours.close}`);
  return parts.filter(Boolean).join("|");
}

/** An override needs the same warnings acknowledged and a reason of 3 or more characters. */
export function overrideAccepted(signature: string, override: OverrideInput | undefined) {
  return Boolean(signature) && override?.acknowledged === signature && (override.reason?.trim().length ?? 0) >= 3;
}
