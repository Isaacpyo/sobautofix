// Pure rules for Staff & access, shared by the server and the unit tests.

export type StaffStatus = "active" | "invited" | "removed";

/** Removed when access was taken away; invited until the first sign-in. */
export function staffStatus(input: { accessRemovedAt: string | null; lastSignInAt: string | null }): StaffStatus {
  if (input.accessRemovedAt) return "removed";
  return input.lastSignInAt ? "active" : "invited";
}

/** Owners who can still sign in. There must always be at least one. */
export function activeOwnerCount(profiles: Array<{ staff_role: string | null; access_removed_at: string | null }>) {
  return profiles.filter((profile) => (profile.staff_role || "owner") === "owner" && !profile.access_removed_at).length;
}

export const staffStatusLabels: Record<StaffStatus, string> = {
  active: "Active",
  invited: "Invited",
  removed: "Access removed",
};
