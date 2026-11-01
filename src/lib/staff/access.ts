import "server-only";

import { isAllowedAdminEmail } from "@/config/admin";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { createAdminClient } from "@/lib/supabase/server";

export function normaliseStaffEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || "";
}

/**
 * Whether an email belongs to an active staff member (Staff & access). Before
 * the staff-access migration reaches a database, the original allowlist in
 * src/config/admin.ts still decides.
 */
export async function isActiveStaffEmail(email: string | null | undefined) {
  const normalised = normaliseStaffEmail(email);
  if (!normalised) return false;
  const client = createAdminClient();
  if (!client) return isAllowedAdminEmail(normalised);
  const { data, error } = await client.from("admin_profiles").select("user_id").eq("email", normalised).is("access_removed_at", null).maybeSingle();
  if (error) return isMissingSchemaError(error) ? isAllowedAdminEmail(normalised) : false;
  return Boolean(data);
}
