import "server-only";

import { z } from "zod";
import { siteConfig } from "@/config/site";
import { renderStaffInvite } from "@/lib/email/templates/auth";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { assertCan, ExchangeUserError, fieldError, must } from "@/lib/exchange/admin/core";
import { staffRoleLabels, staffRoles, type StaffRole } from "@/lib/exchange/permissions";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { normaliseStaffEmail } from "@/lib/staff/access";
import { activeOwnerCount, staffStatus, type StaffStatus } from "@/lib/staff/rules";

// Staff & access (/admin/staff): owners invite staff, change names and roles,
// remove and restore access. Profiles are written only here, with the service
// client, after the owner check; the database refuses direct writes.

export type StaffMember = {
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  twoStepVerification: boolean;
  lastSignInAt: string | null;
  invitedAt: string | null;
  removedAt: string | null;
};

export type StaffChange = { id: string; action: string; at: string; actor: string; detail: Record<string, unknown> };

type ProfileRow = {
  user_id: string;
  display_name: string;
  email: string | null;
  staff_role: string | null;
  invited_at: string | null;
  access_removed_at: string | null;
  created_at: string;
};

const PROFILE_COLUMNS = "user_id,display_name,email,staff_role,invited_at,access_removed_at,created_at";
// Banning the auth user ends any session at its next refresh; the profile flag
// already blocks every page, action and database policy straight away.
const REMOVED_BAN = "876000h";

const name = z.string().trim().min(2, "Enter their name").max(80, "Use 80 characters or fewer");
const role = z.enum(staffRoles);
export const inviteSchema = z.object({ name, email: z.email("Enter a valid email address").transform(normaliseStaffEmail), role });
export const updateSchema = z.object({ userId: z.string().uuid(), name, role });
export const memberSchema = z.object({ userId: z.string().uuid() });

function asRole(value: string | null): StaffRole {
  return (staffRoles as readonly string[]).includes(value || "") ? (value as StaffRole) : "owner";
}

async function loadProfiles(staff: StaffContext) {
  return must(await staff.client.from("admin_profiles").select(PROFILE_COLUMNS).order("created_at"), "Staff could not be loaded.") as ProfileRow[];
}

export async function listStaff(staff: StaffContext): Promise<StaffMember[]> {
  assertCan(staff, "staff.manage");
  const profiles = await loadProfiles(staff);
  const members = await Promise.all(profiles.map(async (profile) => {
    const { data } = await staff.client.auth.admin.getUserById(profile.user_id);
    const user = data?.user;
    const lastSignInAt = user?.last_sign_in_at ?? null;
    return {
      userId: profile.user_id,
      name: profile.display_name,
      email: profile.email || user?.email || "",
      role: asRole(profile.staff_role),
      status: staffStatus({ accessRemovedAt: profile.access_removed_at, lastSignInAt }),
      twoStepVerification: Boolean(user?.factors?.some((factor) => factor.status === "verified")),
      lastSignInAt,
      invitedAt: profile.invited_at,
      removedAt: profile.access_removed_at,
    } satisfies StaffMember;
  }));
  const order: Record<StaffStatus, number> = { active: 0, invited: 1, removed: 2 };
  return members.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, "en-GB"));
}

export async function listStaffChanges(staff: StaffContext, limit = 20): Promise<StaffChange[]> {
  assertCan(staff, "staff.manage");
  const { data } = await staff.client.from("admin_audit_log").select("id,action,created_at,detail").eq("entity_type", "staff").order("created_at", { ascending: false }).limit(limit);
  return (data || []).map((row) => {
    const detail = (row.detail || {}) as Record<string, unknown>;
    return { id: String(row.id), action: String(row.action), at: String(row.created_at), actor: String(detail.actorName || "Staff"), detail };
  });
}

/** Finds the auth user for an email, creating it (confirmed, no password yet) when there is none. */
async function findOrCreateAuthUser(staff: StaffContext, email: string, displayName: string) {
  const created = await staff.client.auth.admin.createUser({ email, email_confirm: true, user_metadata: { display_name: displayName } });
  if (created.data.user) return created.data.user.id;
  // Already registered: the admin API has no lookup by email, and staff are the
  // only accounts, so the list is short.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await staff.client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = data.users.find((user) => normaliseStaffEmail(user.email) === email);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  throw new ExchangeUserError("That account could not be created. Check the email address and try again.");
}

/** A one-time link to the existing password set-up page (the recovery flow). */
async function setupLink(staff: StaffContext, email: string) {
  const redirectTo = new URL("/auth/confirm?next=/admin/reset-password", siteConfig.siteUrl).toString();
  const { data, error } = await staff.client.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
  const token = data?.properties?.hashed_token;
  if (error || !token) throw new ExchangeUserError("The set-up link could not be created. Try again in a minute.");
  const url = new URL("/auth/confirm", siteConfig.siteUrl);
  url.searchParams.set("token_hash", token);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", "/admin/reset-password");
  return url.toString();
}

/**
 * Emails the set-up link. When email cannot be sent (not configured, or the
 * provider refuses it), the link is returned so the owner can pass it on
 * privately instead.
 */
async function deliverInvite(staff: StaffContext, member: { userId: string; name: string; email: string; role: StaffRole }) {
  const link = await setupLink(staff, member.email);
  const email = renderStaffInvite({ name: member.name, invitedBy: staff.displayName, roleLabel: staffRoleLabels[member.role], actionUrl: link });
  try {
    await sendTransactionalEmail({
      to: member.email,
      subject: "You've been invited to the SOB Autofix admin",
      text: email.text,
      html: email.html,
      headers: { "Auto-Submitted": "auto-generated" },
      tags: [{ name: "category", value: "staff_invite" }],
    });
    return { emailed: true as const };
  } catch {
    return { emailed: false as const, link };
  }
}

export async function inviteStaff(staff: StaffContext, input: z.infer<typeof inviteSchema>) {
  assertCan(staff, "staff.manage");
  const profiles = await loadProfiles(staff);
  const existing = profiles.find((profile) => profile.email === input.email);
  if (existing && !existing.access_removed_at) fieldError("email", "This person already has access.");
  if (existing) fieldError("email", "This person's access was removed. Restore it from the list below instead.");
  const userId = await findOrCreateAuthUser(staff, input.email, input.name);
  const now = new Date().toISOString();
  must(await staff.client.from("admin_profiles").insert({ user_id: userId, display_name: input.name, email: input.email, staff_role: input.role, invited_by: staff.userId, invited_at: now }), "The invite could not be saved.");
  await staff.client.auth.admin.updateUserById(userId, { ban_duration: "none" });
  await auditStaffAction(staff, "staff.invited", "staff", userId, { name: input.name, role: input.role });
  return deliverInvite(staff, { userId, name: input.name, email: input.email, role: input.role });
}

export async function resendInvite(staff: StaffContext, input: z.infer<typeof memberSchema>) {
  assertCan(staff, "staff.manage");
  const target = (await loadProfiles(staff)).find((profile) => profile.user_id === input.userId);
  if (!target || target.access_removed_at || !target.email) throw new ExchangeUserError("Only staff with access can be sent a new invite.");
  await auditStaffAction(staff, "staff.invite_resent", "staff", target.user_id, { name: target.display_name });
  return deliverInvite(staff, { userId: target.user_id, name: target.display_name, email: target.email, role: asRole(target.staff_role) });
}

export async function updateStaff(staff: StaffContext, input: z.infer<typeof updateSchema>) {
  assertCan(staff, "staff.manage");
  const profiles = await loadProfiles(staff);
  const target = profiles.find((profile) => profile.user_id === input.userId);
  if (!target) throw new ExchangeUserError("That member of staff no longer exists.");
  const from = asRole(target.staff_role);
  if (input.userId === staff.userId && input.role !== from) fieldError("role", "You cannot change your own role. Ask another owner.");
  if (from === "owner" && input.role !== "owner" && !target.access_removed_at && activeOwnerCount(profiles) <= 1) fieldError("role", "This is the last owner. Make someone else an owner first.");
  must(await staff.client.from("admin_profiles").update({ display_name: input.name, staff_role: input.role, updated_at: new Date().toISOString() }).eq("user_id", input.userId), "The changes could not be saved.");
  await auditStaffAction(staff, "staff.updated", "staff", input.userId, { name: input.name, ...(from !== input.role ? { roleFrom: from, roleTo: input.role } : {}) });
}

export async function removeAccess(staff: StaffContext, input: z.infer<typeof memberSchema>) {
  assertCan(staff, "staff.manage");
  if (input.userId === staff.userId) throw new ExchangeUserError("You cannot remove your own access. Ask another owner.");
  const profiles = await loadProfiles(staff);
  const target = profiles.find((profile) => profile.user_id === input.userId);
  if (!target || target.access_removed_at) throw new ExchangeUserError("This person's access is already removed.");
  if (asRole(target.staff_role) === "owner" && activeOwnerCount(profiles) <= 1) throw new ExchangeUserError("This is the last owner. Make someone else an owner first.");
  const now = new Date().toISOString();
  must(await staff.client.from("admin_profiles").update({ access_removed_at: now, access_removed_by: staff.userId, updated_at: now }).eq("user_id", input.userId), "Access could not be removed.");
  await staff.client.auth.admin.updateUserById(input.userId, { ban_duration: REMOVED_BAN });
  await staff.client.from("admin_trusted_devices").delete().eq("user_id", input.userId);
  await auditStaffAction(staff, "staff.access_removed", "staff", input.userId, { name: target.display_name });
}

export async function restoreAccess(staff: StaffContext, input: z.infer<typeof memberSchema>) {
  assertCan(staff, "staff.manage");
  const target = (await loadProfiles(staff)).find((profile) => profile.user_id === input.userId);
  if (!target || !target.access_removed_at) throw new ExchangeUserError("This person already has access.");
  must(await staff.client.from("admin_profiles").update({ access_removed_at: null, access_removed_by: null, updated_at: new Date().toISOString() }).eq("user_id", input.userId), "Access could not be restored.");
  await staff.client.auth.admin.updateUserById(input.userId, { ban_duration: "none" });
  await auditStaffAction(staff, "staff.access_restored", "staff", input.userId, { name: target.display_name });
}
