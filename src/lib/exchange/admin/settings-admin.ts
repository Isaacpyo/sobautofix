import "server-only";

import { z } from "zod";
import { exchangePolicyPages, exchangePrivateDefaults, exchangePublicDefaults, type ExchangePrivateSettings, type ExchangePublicSettings } from "@/config/exchange";
import { isStaffRole, staffRoles, type StaffRole } from "@/lib/exchange/permissions";
import { mergeSettings } from "@/lib/exchange/settings";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { assertCan, ExchangeUserError, fieldError, guardCopy, must, requiredInt } from "./core";

export async function loadSettingsForEdit(staff: StaffContext) {
  assertCan(staff, "settings.manage");
  const [publicRow, privateRow, profiles] = await Promise.all([
    staff.client.from("exchange_settings").select("value,updated_at").eq("id", true).maybeSingle(),
    staff.client.from("exchange_private_settings").select("value,updated_at").eq("id", true).maybeSingle(),
    staff.client.from("admin_profiles").select("user_id,display_name,staff_role").order("display_name"),
  ]);
  return {
    publicSettings: mergeSettings(exchangePublicDefaults, publicRow.data?.value) as ExchangePublicSettings,
    privateSettings: mergeSettings(exchangePrivateDefaults, privateRow.data?.value) as ExchangePrivateSettings,
    publicUpdatedAt: (publicRow.data?.updated_at as string | undefined) || null,
    privateUpdatedAt: (privateRow.data?.updated_at as string | undefined) || null,
    staff: ((profiles.data || []) as Array<{ user_id: string; display_name: string; staff_role: string | null }>).map((row) => ({ id: row.user_id, name: row.display_name, role: (isStaffRole(row.staff_role) ? row.staff_role : "owner") as StaffRole })),
  };
}

const copy = (max: number) => z.preprocess((value) => (typeof value === "string" ? value : ""), z.string().trim().max(max, `Keep this under ${max.toLocaleString("en-GB")} characters.`));
const phone = z.preprocess((value) => (typeof value === "string" ? value : ""), z.string().trim().max(30).refine((value) => !value || /^[+\d][\d\s()-]{6,}$/.test(value), "Enter a phone number, or leave blank to use the main SOB Autofix number."));

export const publicSettingsSchema = z.object({
  name: copy(80).refine((value) => value.length >= 3, "Enter a name of at least 3 characters."),
  shortName: copy(40).refine((value) => value.length >= 2, "Enter a short name."),
  tagline: copy(160),
  heroHeading: copy(160),
  heroBody: copy(400),
  phone,
  whatsapp: phone,
  email: z.preprocess((value) => (typeof value === "string" ? value : ""), z.string().trim().max(160).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email address, or leave blank.")),
  openingHours: copy(600),
  sellerResponsePromise: copy(300),
  buyingProcess: copy(4000),
  viewingInformation: copy(4000),
  paymentInformation: copy(4000),
  collectionDelivery: copy(4000),
  afterSales: copy(4000),
  warrantyInformation: copy(4000),
  partExchangeInformation: copy(4000),
  inspectionProcess: copy(4000),
  ...Object.fromEntries(exchangePolicyPages.map((page) => [`policy_${page.key}`, copy(20000)])),
});

export async function savePublicSettings(staff: StaffContext, raw: z.infer<typeof publicSettingsSchema>) {
  assertCan(staff, "settings.manage");
  const input = raw as Record<string, string>;
  guardCopy(Object.fromEntries(Object.entries(input).filter(([key]) => !["phone", "whatsapp", "email"].includes(key))));
  const value: ExchangePublicSettings = {
    ...(Object.fromEntries(Object.keys(exchangePublicDefaults).filter((key) => key !== "policies").map((key) => [key, input[key] ?? ""])) as Omit<ExchangePublicSettings, "policies">),
    policies: Object.fromEntries(exchangePolicyPages.map((page) => [page.key, input[`policy_${page.key}`] ?? ""])) as ExchangePublicSettings["policies"],
  };
  must(await staff.client.from("exchange_settings").upsert({ id: true, value, updated_by: staff.userId }), "The settings could not be saved.");
  await auditStaffAction(staff, "update", "exchange_settings", "public", { fields: Object.keys(input).filter((key) => input[key]).length });
}

export const privateSettingsSchema = z.object({
  notificationRecipients: z.preprocess((value) => (typeof value === "string" ? value.split(/[\n,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean) : []), z.array(z.string()).max(10, "Add up to 10 recipients.")),
  viewingLengthMinutes: requiredInt("the viewing length", 15, 240),
  minimumPublishPhotos: requiredInt("the minimum photos", 1, 20),
  sellerRetentionMonths: requiredInt("the retention period", 1, 120),
  reservationHoldDays: requiredInt("the reservation hold", 0, 60),
  handoverChecklist: z.preprocess((value) => (typeof value === "string" ? value.split("\n").map((item) => item.trim()).filter(Boolean) : []), z.array(z.string().max(120, "Keep each step under 120 characters.")).max(20, "Add up to 20 steps.")),
});

export async function savePrivateSettings(staff: StaffContext, input: z.infer<typeof privateSettingsSchema>) {
  assertCan(staff, "settings.manage");
  const invalid = input.notificationRecipients.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid.length) fieldError("notificationRecipients", `Check these addresses: ${invalid.join(", ")}`);
  const value: ExchangePrivateSettings = { ...input, notificationRecipients: [...new Set(input.notificationRecipients)] };
  must(await staff.client.from("exchange_private_settings").upsert({ id: true, value, updated_by: staff.userId }), "The settings could not be saved.");
  await auditStaffAction(staff, "update", "exchange_settings", "private", { recipients: value.notificationRecipients.length, reservationHoldDays: value.reservationHoldDays, handoverSteps: value.handoverChecklist.length, minimumPublishPhotos: value.minimumPublishPhotos });
}

export const roleSchema = z.object({ userId: z.string().uuid(), role: z.enum(staffRoles) });

/** Changes a staff role. Nobody changes their own role, and the last owner cannot be demoted. */
export async function changeStaffRole(staff: StaffContext, input: z.infer<typeof roleSchema>) {
  assertCan(staff, "settings.manage");
  if (input.userId === staff.userId) throw new ExchangeUserError("You cannot change your own role. Ask another owner.");
  const profiles = must(await staff.client.from("admin_profiles").select("user_id,staff_role"), "Staff could not be loaded.") as Array<{ user_id: string; staff_role: string | null }>;
  const target = profiles.find((profile) => profile.user_id === input.userId);
  if (!target) throw new ExchangeUserError("That member of staff no longer exists.");
  const owners = profiles.filter((profile) => (profile.staff_role || "owner") === "owner");
  if ((target.staff_role || "owner") === "owner" && input.role !== "owner" && owners.length <= 1) throw new ExchangeUserError("This is the last owner. Make someone else an owner first.");
  must(await staff.client.from("admin_profiles").update({ staff_role: input.role }).eq("user_id", input.userId), "The role could not be changed.");
  await auditStaffAction(staff, "role_change", "admin_profile", input.userId, { from: target.staff_role || "owner", to: input.role });
}
