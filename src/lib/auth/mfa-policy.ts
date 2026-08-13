import type { SupabaseClient } from "@supabase/supabase-js";

export async function isMandatoryAdminMfaEnabled(client: SupabaseClient | null) {
  // Only an explicit, readable rollout value of false permits an unenrolled
  // administrator. Missing policy state and query failures fail closed.
  if (!client) return true;
  const { data, error } = await client
    .from("admin_mfa_policy")
    .select("mandatory_mfa_enabled")
    .eq("singleton", true)
    .maybeSingle();
  return error ? true : data?.mandatory_mfa_enabled !== false;
}
