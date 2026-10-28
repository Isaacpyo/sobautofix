import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeAdminReturnTo } from "@/lib/auth/mfa";
import { can, isStaffRole, type ExchangePermission, type StaffRole } from "@/lib/exchange/permissions";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";

export type StaffContext = {
  userId: string;
  displayName: string;
  role: StaffRole;
  can: (permission: ExchangePermission) => boolean;
  client: NonNullable<ReturnType<typeof createAdminClient>>;
};

export class StaffPermissionError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "StaffPermissionError";
  }
}

/** Role for a signed-in administrator. Defaults to owner while the role column does not exist yet. */
export async function getStaffRole(client: NonNullable<ReturnType<typeof createAdminClient>>, userId: string): Promise<StaffRole> {
  const { data, error } = await client.from("admin_profiles").select("staff_role").eq("user_id", userId).maybeSingle();
  if (error || !data) return "owner";
  return isStaffRole(data.staff_role) ? data.staff_role : "owner";
}

async function loadStaff(): Promise<StaffContext | null> {
  const auth = await getAdminUser({ requireMfa: false, allowTrustedDevice: true });
  const client = createAdminClient();
  if (!auth || !client) return null;
  if (auth.mfaState === "enrollment_required" || auth.mfaState === "challenge_required") return null;
  const role = await getStaffRole(client, auth.user.id);
  return { userId: auth.user.id, displayName: auth.profile.display_name, role, can: (permission) => can(role, permission), client };
}

/**
 * For server components (pages). Redirects to sign in when there is no
 * session and renders the shared not-permitted state otherwise.
 */
export async function requireStaffPage(permission: ExchangePermission = "exchange.view") {
  const staff = await loadStaff();
  if (!staff) redirect("/admin/login");
  return { staff, allowed: staff.can(permission) };
}

/**
 * For server actions and route handlers. Mirrors the existing requireAdmin()
 * step-up behaviour: an un-verified MFA session is sent to the challenge.
 */
export async function requireStaffAction(permission: ExchangePermission): Promise<StaffContext> {
  const auth = await getAdminUser({ requireMfa: false });
  if (auth?.mfaState === "enrollment_required") redirect("/admin/mfa/enroll");
  if (auth?.mfaRequired && !auth.mfaVerified) {
    const referer = (await headers()).get("referer");
    let returnTo = "/admin";
    try {
      const url = referer ? new URL(referer) : null;
      returnTo = safeAdminReturnTo(url ? `${url.pathname}${url.search}` : null);
    } catch {
      returnTo = "/admin";
    }
    redirect(`/admin/mfa?returnTo=${encodeURIComponent(returnTo)}&stepUp=1`);
  }
  const client = createAdminClient();
  if (!auth || !client) throw new StaffPermissionError("Your admin session has expired. Sign in again.");
  const role = await getStaffRole(client, auth.user.id);
  if (!can(role, permission)) throw new StaffPermissionError();
  return { userId: auth.user.id, displayName: auth.profile.display_name, role, can: (next) => can(role, next), client };
}

/** For route handlers that must answer with a status code instead of redirecting. */
export async function getStaffForRoute(permission: ExchangePermission) {
  const staff = await loadStaff();
  if (!staff) return { staff: null, status: 401 as const };
  if (!staff.can(permission)) return { staff: null, status: 403 as const };
  return { staff, status: 200 as const };
}

export async function auditStaffAction(staff: StaffContext, action: string, entityType: string, entityId: string, detail: Record<string, unknown> = {}) {
  const { error } = await staff.client.from("admin_audit_log").insert({ actor_id: staff.userId, action, entity_type: entityType, entity_id: entityId, detail: { ...detail, actorName: staff.displayName } });
  if (error) throw new Error("The change was saved, but its required audit entry could not be recorded.");
}
