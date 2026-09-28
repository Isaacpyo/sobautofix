"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import { manageTrashAction } from "@/app/admin/(protected)/trash/actions";

export type CatalogueActionState = { success: boolean; message: string };

export async function trashCatalogueItemAction(formData: FormData): Promise<void> {
  await manageTrashAction(formData);
}

const uuid = z.string().uuid();
const systemSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
});
const serviceSchema = z.object({
  id: uuid.optional(),
  systemId: uuid,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(600),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  providerEventTypeId: z.preprocess((value) => value === "" || value == null ? null : value, z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable()),
  onlineBookingEnabled: z.boolean(),
  locationMode: z.enum(["workshop", "mobile", "both"]),
}).refine((value) => !value.onlineBookingEnabled || value.providerEventTypeId !== null, {
  path: ["providerEventTypeId"],
  message: "A calendar event type is required for online booking",
});

async function verifiedAdmin() {
  const admin = await getAdminUser({ requireMfa: false, allowTrustedDevice: true });
  if (!admin) redirect("/admin/login?returnTo=%2Fadmin%2Fservice-catalogue");
  if (admin.mfaState === "enrollment_required") redirect("/admin/mfa/enroll");
  if (admin.mfaState === "challenge_required") redirect("/admin/mfa?returnTo=%2Fadmin%2Fservice-catalogue&stepUp=1");
  return admin;
}

export async function createCatalogueSystemAction(_state: CatalogueActionState, formData: FormData): Promise<CatalogueActionState> {
  const admin = await verifiedAdmin();
  const parsed = systemSchema.omit({ id: true }).safeParse(systemInput(formData));
  if (!parsed.success) return { success: false, message: "Enter a name, description and valid display order." };
  const client = createAdminClient();
  if (!client) return unavailable();
  const key = await uniqueKey(client, "service_catalogue_systems", "system_key", slug(parsed.data.name));
  const { data, error } = await client.from("service_catalogue_systems").insert({
    system_key: key,
    display_name: parsed.data.name,
    description: parsed.data.description,
    sort_order: parsed.data.sortOrder,
  }).select("id").single();
  if (error || !data) return { success: false, message: "The vehicle system could not be created." };
  await audit(client, admin.user.id, "create", "service_catalogue_system", data.id, { key });
  revalidateCatalogue();
  return { success: true, message: "Vehicle system created." };
}

export async function updateCatalogueSystemAction(_state: CatalogueActionState, formData: FormData): Promise<CatalogueActionState> {
  const admin = await verifiedAdmin();
  const parsed = systemSchema.safeParse({ ...systemInput(formData), id: formData.get("id") });
  if (!parsed.success) return { success: false, message: "Check the vehicle-system details and try again." };
  const client = createAdminClient();
  if (!client) return unavailable();
  const { data, error } = await client.from("service_catalogue_systems").update({ display_name: parsed.data.name, description: parsed.data.description, sort_order: parsed.data.sortOrder }).eq("id", parsed.data.id).is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) return { success: false, message: "The vehicle system could not be saved." };
  await audit(client, admin.user.id, "update", "service_catalogue_system", data.id, {});
  revalidateCatalogue();
  return { success: true, message: "Vehicle system saved." };
}

export async function createCatalogueServiceAction(_state: CatalogueActionState, formData: FormData): Promise<CatalogueActionState> {
  const admin = await verifiedAdmin();
  const parsed = serviceSchema.safeParse(serviceInput(formData));
  if (!parsed.success) return serviceValidationMessage(parsed.error.issues.some((issue) => issue.path.includes("providerEventTypeId")));
  const client = createAdminClient();
  if (!client) return unavailable();
  const { data: system } = await client.from("service_catalogue_systems").select("system_key").eq("id", parsed.data.systemId).is("deleted_at", null).maybeSingle();
  if (!system) return { success: false, message: "Choose an active vehicle system." };
  const key = await uniqueKey(client, "booking_service_types", "service_key", `${system.system_key}-${slug(parsed.data.name)}`);
  const { data, error } = await client.from("booking_service_types").insert({
    system_id: parsed.data.systemId,
    service_key: key,
    display_name: parsed.data.name,
    description: parsed.data.description,
    sort_order: parsed.data.sortOrder,
    provider: "calcom",
    provider_event_type_id: parsed.data.providerEventTypeId,
    online_booking_enabled: parsed.data.onlineBookingEnabled,
    location_mode: parsed.data.locationMode,
  }).select("id").single();
  if (error || !data) return { success: false, message: "The service could not be created." };
  await audit(client, admin.user.id, "create", "service_catalogue_service", data.id, { key });
  revalidateCatalogue();
  return { success: true, message: "Service created." };
}

export async function updateCatalogueServiceAction(_state: CatalogueActionState, formData: FormData): Promise<CatalogueActionState> {
  const admin = await verifiedAdmin();
  const parsed = serviceSchema.safeParse({ ...serviceInput(formData), id: formData.get("id") });
  if (!parsed.success) return serviceValidationMessage(parsed.error.issues.some((issue) => issue.path.includes("providerEventTypeId")));
  const client = createAdminClient();
  if (!client) return unavailable();
  const { data, error } = await client.from("booking_service_types").update({
    system_id: parsed.data.systemId,
    display_name: parsed.data.name,
    description: parsed.data.description,
    sort_order: parsed.data.sortOrder,
    provider: "calcom",
    provider_event_type_id: parsed.data.providerEventTypeId,
    online_booking_enabled: parsed.data.onlineBookingEnabled,
    location_mode: parsed.data.locationMode,
  }).eq("id", parsed.data.id).is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) return { success: false, message: "The service could not be saved." };
  await audit(client, admin.user.id, "update", "service_catalogue_service", data.id, { onlineBookingEnabled: parsed.data.onlineBookingEnabled });
  revalidateCatalogue();
  return { success: true, message: "Service saved everywhere." };
}

function systemInput(formData: FormData) {
  return { name: formData.get("name"), description: formData.get("description"), sortOrder: formData.get("sortOrder") };
}

function serviceInput(formData: FormData) {
  return {
    systemId: formData.get("systemId"),
    name: formData.get("name"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
    providerEventTypeId: formData.get("providerEventTypeId"),
    onlineBookingEnabled: formData.get("onlineBookingEnabled") === "on",
    locationMode: formData.get("locationMode"),
  };
}

function slug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "service";
}

async function uniqueKey(client: NonNullable<ReturnType<typeof createAdminClient>>, table: "service_catalogue_systems" | "booking_service_types", column: "system_key" | "service_key", requested: string) {
  const { data } = await client.from(table).select(column).like(column, `${requested}%`);
  const keys = new Set((data || []).map((row) => String(row[column as keyof typeof row])));
  if (!keys.has(requested)) return requested;
  let suffix = 2;
  while (keys.has(`${requested}-${suffix}`)) suffix += 1;
  return `${requested}-${suffix}`;
}

async function audit(client: NonNullable<ReturnType<typeof createAdminClient>>, actorId: string, action: string, entityType: string, entityId: string, detail: Record<string, unknown>) {
  await client.from("admin_audit_log").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, detail });
}

function revalidateCatalogue() {
  revalidatePath("/admin/service-catalogue");
  revalidatePath("/admin/bookings/services");
  revalidatePath("/admin/invoices/new");
  revalidatePath("/book");
  revalidatePath("/services");
}

function unavailable(): CatalogueActionState { return { success: false, message: "The service catalogue is temporarily unavailable." }; }
function serviceValidationMessage(mappingIssue: boolean): CatalogueActionState { return { success: false, message: mappingIssue ? "Add a calendar event type before enabling online booking." : "Check the service details and try again." }; }
