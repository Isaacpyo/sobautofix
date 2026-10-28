import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { failure, type FormState } from "@/components/admin/exchange/form-state";
import { guardExchangeContent } from "@/lib/content-guard";
import type { ExchangePermission } from "@/lib/exchange/permissions";
import { ExchangeSchemaMissingError, isMissingSchemaError, SCHEMA_MISSING_MESSAGE } from "@/lib/exchange/schema";
import { requireStaffAction, StaffPermissionError, type StaffContext } from "@/lib/exchange/staff";

export type StaffClient = StaffContext["client"];

/** A problem staff can fix. Its message (and field errors) are shown as-is. */
export class ExchangeUserError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ExchangeUserError";
    this.fieldErrors = fieldErrors;
  }
}

export function fieldError(field: string, message: string): never {
  throw new ExchangeUserError(message, { [field]: message });
}

/**
 * Turns any thrown error into a safe form result. Raw database errors are
 * never shown: only messages we wrote ourselves reach the browser.
 */
export function toFormFailure(error: unknown, formData?: FormData): FormState {
  if (error instanceof StaffPermissionError) return failure(error.message, formData);
  if (error instanceof ExchangeUserError) return failure(error.message, formData, error.fieldErrors);
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return failure("Check the highlighted fields and try again.", formData, fieldErrors);
  }
  if (error instanceof ExchangeSchemaMissingError || isMissingSchemaError(error)) return failure(SCHEMA_MISSING_MESSAGE, formData);
  // Log the error class and database code only; messages can contain personal data.
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : undefined;
  console.error("exchange admin action failed", { name: error instanceof Error ? error.name : typeof error, code });
  return failure("That could not be saved. Nothing was changed; please try again.", formData);
}

/** Permission check + safe error handling for every Vehicle Buying & Selling action. */
export async function runStaffAction(permission: ExchangePermission | ExchangePermission[], formData: FormData, handler: (staff: StaffContext) => Promise<FormState>): Promise<FormState> {
  try {
    const permissions = Array.isArray(permission) ? permission : [permission];
    const staff = await requireStaffAction(permissions[0]!);
    for (const extra of permissions.slice(1)) if (!staff.can(extra)) throw new StaffPermissionError();
    return await handler(staff);
  } catch (error) {
    unstable_rethrow(error);
    return toFormFailure(error, formData);
  }
}

/** Requires the staff member to hold every listed permission. */
export function assertCan(staff: Pick<StaffContext, "can">, ...permissions: ExchangePermission[]) {
  for (const permission of permissions) if (!staff.can(permission)) throw new StaffPermissionError();
}

type DbResult<T> = { data: T; error: { code?: string; message?: string } | null };

/** Unwraps a Supabase result, mapping missing-schema and constraint errors to safe messages. */
export function must<R extends DbResult<unknown>>(result: R, message: string): R["data"] {
  if (result.error) {
    if (isMissingSchemaError(result.error)) throw new ExchangeSchemaMissingError();
    if (result.error.code === "23505") throw new ExchangeUserError(`${message} A record with the same details already exists.`);
    throw new ExchangeUserError(message);
  }
  return result.data;
}

/** Like must(), for .single(): a missing row is an error too. */
export function mustRow<R extends DbResult<unknown>>(result: R, message: string): NonNullable<R["data"]> {
  const data = must(result, message);
  if (data == null) throw new ExchangeUserError(message);
  return data as NonNullable<R["data"]>;
}

/** Customer-facing copy may state MOT facts but never offer the test as a service. */
export function guardCopy(fields: Record<string, unknown>) {
  const fieldErrors: Record<string, string> = {};
  for (const [field, value] of Object.entries(fields)) {
    if (value == null || value === "") continue;
    const result = guardExchangeContent(value);
    if (!result.safe) fieldErrors[field] = result.reason;
  }
  if (Object.keys(fieldErrors).length) throw new ExchangeUserError("Some customer-facing text is not allowed. Check the highlighted fields.", fieldErrors);
}

// ---------------------------------------------------------------------------
// Form field schemas. FormData values are strings; blanks become null.
// ---------------------------------------------------------------------------

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

export const formText = (label: string, max: number, min = 1) => z.string({ error: `Enter ${label}.` }).trim().min(min, min > 1 ? `${capitalise(label)} must be at least ${min} characters.` : `Enter ${label}.`).max(max, `${capitalise(label)} must be ${max} characters or fewer.`);
export const optionalText = (label: string, max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max, `${capitalise(label)} must be ${max} characters or fewer.`).optional()).transform((value) => value ?? null);
export const optionalInt = (label: string, min: number, max: number) => z.preprocess(blankToUndefined, z.coerce.number({ error: `Enter a whole number for ${label}.` }).int(`Enter a whole number for ${label}.`).min(min, `${capitalise(label)} must be at least ${min}.`).max(max, `${capitalise(label)} must be ${max} or less.`).optional()).transform((value) => value ?? null);
export const requiredInt = (label: string, min: number, max: number) => z.preprocess(blankToUndefined, z.coerce.number({ error: `Enter ${label}.` }).int(`Enter a whole number for ${label}.`).min(min, `${capitalise(label)} must be at least ${min}.`).max(max, `${capitalise(label)} must be ${max} or less.`));
export const optionalDate = (label: string) => z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `Enter a valid date for ${label}.`).optional()).transform((value) => value ?? null);
export const optionalDateTime = (label: string) => z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, `Enter a valid date and time for ${label}.`).optional()).transform((value) => (value ? londonLocalToIso(value) : null));
export const uuidField = (label = "record") => z.string({ error: `Missing ${label}.` }).uuid(`Missing ${label}.`);
/** Pounds and pence typed by staff → integer pence. */
export const moneyPence = (label: string) => z.preprocess(blankToUndefined, z.string({ error: `Enter ${label}.` }).trim().regex(/^£?\d{1,7}(\.\d{1,2})?$/, `Enter ${label} in pounds, for example 4500 or 4500.50.`)).transform((value) => Math.round(Number(value.replace("£", "")) * 100));
export const optionalMoneyPence = (label: string) => z.preprocess(blankToUndefined, z.string().trim().regex(/^£?\d{1,7}(\.\d{1,2})?$/, `Enter ${label} in pounds, for example 4500 or 4500.50.`).optional()).transform((value) => (value == null ? null : Math.round(Number(value.replace("£", "")) * 100)));
export const lines = (label: string, maxItems: number, maxLength: number) => z.preprocess((value) => (typeof value === "string" ? value.split("\n").map((line) => line.trim()).filter(Boolean) : []), z.array(z.string().max(maxLength, `Each ${label} line must be ${maxLength} characters or fewer.`)).max(maxItems, `List up to ${maxItems} ${label} items.`));
export const checkbox = () => z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

export function parseForm<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string" && !key.startsWith("$ACTION")) raw[key] = value;
  return schema.parse(raw);
}

/** Converts a datetime-local value entered in UK time to an ISO timestamp. */
export function londonLocalToIso(local: string) {
  const [datePart, timePart] = local.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const [hour, minute] = timePart!.split(":").map(Number);
  const utcGuess = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const offset = londonOffsetMinutes(new Date(utcGuess));
  const adjusted = utcGuess - offset * 60_000;
  // Recheck around the clock change, where the offset of the result may differ.
  const secondOffset = londonOffsetMinutes(new Date(adjusted));
  return new Date(utcGuess - secondOffset * 60_000).toISOString();
}

function londonOffsetMinutes(date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Revalidation. Admin pages plus every public page that shows stock.
// ---------------------------------------------------------------------------

export function revalidateExchangeAdmin() {
  revalidatePath("/admin/exchange", "layout");
  revalidatePath("/admin", "layout");
}

export function revalidatePublicStock(slug?: string | null) {
  for (const path of ["/exchange", "/exchange/cars", "/exchange/cars/sold", "/exchange/sitemap.xml", "/cars-for-sale", "/sitemap.xml"]) revalidatePath(path);
  if (slug) {
    revalidatePath(`/exchange/cars/${slug}`);
    revalidatePath(`/cars-for-sale/${slug}`);
  }
}

// ---------------------------------------------------------------------------
// Staff directory (assignment pickers and history).
// ---------------------------------------------------------------------------

export type StaffMember = { id: string; name: string; role: string };

export async function listStaff(client: StaffClient): Promise<StaffMember[]> {
  const withRole = await client.from("admin_profiles").select("user_id,display_name,staff_role").order("display_name");
  if (!withRole.error) return (withRole.data || []).map((row) => ({ id: row.user_id as string, name: row.display_name as string, role: (row.staff_role as string) || "owner" }));
  const basic = await client.from("admin_profiles").select("user_id,display_name").order("display_name");
  return (basic.data || []).map((row) => ({ id: row.user_id as string, name: row.display_name as string, role: "owner" }));
}

export async function assertStaffMember(client: StaffClient, userId: string | null) {
  if (!userId) return;
  const { data } = await client.from("admin_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) fieldError("assignedTo", "Choose a member of staff from the list.");
}
