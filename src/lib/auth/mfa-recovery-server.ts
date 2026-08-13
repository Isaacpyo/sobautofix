import "server-only";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { clearTrustedDeviceCookie } from "@/lib/auth/trusted-device-server";
import {
  generateMfaRecoveryCodeSet,
  generateMfaRecoverySessionToken,
  hashMfaRecoveryCode,
  hashMfaRecoverySessionToken,
  isMfaRecoveryCode,
  MFA_RECOVERY_COOKIE,
  MFA_RECOVERY_COOKIE_OPTIONS,
  MFA_RECOVERY_SESSION_SECONDS,
} from "@/lib/auth/mfa-recovery";

export type ActiveMfaRecoverySession = {
  id: string;
  user_id: string;
  recovery_code_id: string;
  old_factor_ids: string[];
  new_factor_id: string | null;
  created_at: string;
  expires_at: string;
  verified_at: string | null;
  completed_at: string | null;
  revoked_at: string | null;
};

export async function createMfaRecoveryCodeSet(
  userId: string,
  event: "mfa_recovery_codes_created" | "mfa_recovery_codes_regenerated",
) {
  const client = createAdminClient();
  if (!client) return null;
  const codes = generateMfaRecoveryCodeSet();
  const { data, error } = await client.rpc("replace_admin_mfa_recovery_codes", {
    p_user_id: userId,
    p_code_hashes: codes.map(hashMfaRecoveryCode),
    p_event_action: event,
  });
  if (error || data !== codes.length) return null;
  await clearTrustedDeviceCookie();
  return codes;
}

export async function getMfaRecoveryCodeSummary(userId: string) {
  const client = createAdminClient();
  if (!client) return { total: 0, remaining: 0 };
  const { data: latest, error: latestError } = await client
    .from("admin_mfa_recovery_codes")
    .select("set_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError || !latest) return { total: 0, remaining: 0 };
  const { data, error } = await client
    .from("admin_mfa_recovery_codes")
    .select("used_at,revoked_at")
    .eq("user_id", userId)
    .eq("set_id", latest.set_id);
  if (error || !data) return { total: 0, remaining: 0 };
  return {
    total: data.length,
    remaining: data.filter((code) => !code.used_at && !code.revoked_at).length,
  };
}

export async function consumeMfaRecoveryCode(userId: string, code: string) {
  if (!isMfaRecoveryCode(code)) return false;
  const client = createAdminClient();
  if (!client) return false;
  const rawToken = generateMfaRecoverySessionToken();
  const expiresAt = new Date(Date.now() + MFA_RECOVERY_SESSION_SECONDS * 1000).toISOString();
  const { data, error } = await client.rpc("consume_admin_mfa_recovery_code", {
    p_user_id: userId,
    p_code_hash: hashMfaRecoveryCode(code),
    p_session_token_hash: hashMfaRecoverySessionToken(rawToken),
    p_expires_at: expiresAt,
  });
  if (error || data !== true) return false;
  await clearTrustedDeviceCookie();
  (await cookies()).set(MFA_RECOVERY_COOKIE, rawToken, MFA_RECOVERY_COOKIE_OPTIONS);
  return true;
}

export async function getActiveMfaRecoverySession(userId: string) {
  const rawToken = (await cookies()).get(MFA_RECOVERY_COOKIE)?.value;
  if (!rawToken || !/^[0-9a-f]{64}$/.test(rawToken)) return null;
  const client = createAdminClient();
  if (!client) return null;
  const { data, error } = await client
    .from("admin_mfa_recovery_sessions")
    .select("id,user_id,recovery_code_id,old_factor_ids,new_factor_id,created_at,expires_at,verified_at,completed_at,revoked_at")
    .eq("user_id", userId)
    .eq("token_hash", hashMfaRecoverySessionToken(rawToken))
    .is("completed_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return error || !data ? null : data as ActiveMfaRecoverySession;
}

export async function setMfaRecoveryNewFactor(userId: string, sessionId: string, factorId: string) {
  const rawToken = (await cookies()).get(MFA_RECOVERY_COOKIE)?.value;
  if (!rawToken) return false;
  const client = createAdminClient();
  if (!client) return false;
  const { data, error } = await client
    .from("admin_mfa_recovery_sessions")
    .update({ new_factor_id: factorId })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("token_hash", hashMfaRecoverySessionToken(rawToken))
    .is("completed_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  return !error && data?.id === sessionId;
}

export async function completeMfaRecovery(userId: string, sessionId: string, newFactorId: string) {
  const rawToken = (await cookies()).get(MFA_RECOVERY_COOKIE)?.value;
  if (!rawToken) return false;
  const client = createAdminClient();
  if (!client) return false;
  const completedAt = new Date().toISOString();
  const { data, error } = await client
    .from("admin_mfa_recovery_sessions")
    .update({ verified_at: completedAt, completed_at: completedAt })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("token_hash", hashMfaRecoverySessionToken(rawToken))
    .eq("new_factor_id", newFactorId)
    .is("completed_at", null)
    .is("revoked_at", null)
    .gt("expires_at", completedAt)
    .select("id")
    .maybeSingle();
  if (error || data?.id !== sessionId) return false;
  await client.from("admin_audit_log").insert({
    actor_id: userId,
    action: "mfa_factor_replaced",
    entity_type: "admin_security",
    entity_id: userId,
    detail: { recoverySessionId: sessionId, newFactorId },
  });
  await clearMfaRecoveryCookie();
  return true;
}

export async function revokeMfaRecoveryMaterial(userId: string, reason: string) {
  const client = createAdminClient();
  if (!client) return false;
  const revokedAt = new Date().toISOString();
  const [codes, sessions] = await Promise.all([
    client.from("admin_mfa_recovery_codes").update({ revoked_at: revokedAt }).eq("user_id", userId).is("used_at", null).is("revoked_at", null),
    client.from("admin_mfa_recovery_sessions").update({ revoked_at: revokedAt }).eq("user_id", userId).is("completed_at", null).is("revoked_at", null),
  ]);
  if (codes.error || sessions.error) return false;
  await client.from("admin_audit_log").insert({
    actor_id: userId,
    action: "mfa_recovery_material_revoked",
    entity_type: "admin_security",
    entity_id: userId,
    detail: { reason },
  });
  await clearMfaRecoveryCookie();
  return true;
}

export async function clearMfaRecoveryCookie() {
  (await cookies()).set(MFA_RECOVERY_COOKIE, "", { ...MFA_RECOVERY_COOKIE_OPTIONS, maxAge: 0 });
}
