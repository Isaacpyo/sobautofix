import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import {
  findValidTrustedDevice,
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
  summarizeUserAgent,
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_COOKIE_OPTIONS,
  TRUSTED_DEVICE_LIFETIME_SECONDS,
} from "@/lib/auth/trusted-device";

export async function getCurrentTrustedDevice(userId: string, options: { touch?: boolean } = {}) {
  const client = createAdminClient();
  if (!client) return null;
  const rawToken = (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;
  return findValidTrustedDevice(client, userId, rawToken, options);
}

export async function trustCurrentDevice(userId: string) {
  const client = createAdminClient();
  if (!client) return false;
  const rawToken = generateTrustedDeviceToken();
  const tokenHash = await hashTrustedDeviceToken(rawToken);
  const userAgent = (await headers()).get("user-agent");
  const deviceLabel = summarizeUserAgent(userAgent);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_LIFETIME_SECONDS * 1000).toISOString();
  const { data, error } = await client.from("admin_trusted_devices").insert({
    user_id: userId,
    token_hash: tokenHash,
    device_label: deviceLabel,
    user_agent_summary: deviceLabel,
    expires_at: expiresAt,
  }).select("id").single();
  if (error || !data) return false;
  const { error: auditError } = await client.from("admin_audit_log").insert({
    actor_id: userId,
    action: "mfa_trusted_device_added",
    entity_type: "admin_trusted_device",
    entity_id: data.id,
    detail: { deviceLabel, expiresAt },
  });
  if (auditError) {
    await client.from("admin_trusted_devices").delete().eq("id", data.id).eq("user_id", userId);
    return false;
  }
  (await cookies()).set(TRUSTED_DEVICE_COOKIE, rawToken, TRUSTED_DEVICE_COOKIE_OPTIONS);
  return true;
}

export async function clearTrustedDeviceCookie() {
  (await cookies()).set(TRUSTED_DEVICE_COOKIE, "", { ...TRUSTED_DEVICE_COOKIE_OPTIONS, maxAge: 0 });
}

export async function requireFreshAdminSession(returnTo = "/admin") {
  const admin = await getAdminUser({ requireMfa: false });
  if (admin?.mfaRequired && !admin.mfaVerified) {
    redirect(`/admin/mfa?returnTo=${encodeURIComponent(returnTo)}&stepUp=1`);
  }
  return admin;
}

export async function revokeAllTrustedDevices(userId: string, action = "mfa_trusted_devices_revoked_all") {
  const client = createAdminClient();
  if (!client) return false;
  const revokedAt = new Date().toISOString();
  const { error } = await client.from("admin_trusted_devices").update({ revoked_at: revokedAt }).eq("user_id", userId).is("revoked_at", null);
  if (error) return false;
  await client.from("admin_audit_log").insert({ actor_id: userId, action, entity_type: "admin_security", entity_id: userId, detail: {} });
  await clearTrustedDeviceCookie();
  return true;
}
