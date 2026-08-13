import type { SupabaseClient } from "@supabase/supabase-js";

export const TRUSTED_DEVICE_COOKIE = "sob_admin_trusted_device";
export const TRUSTED_DEVICE_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
export const TRUSTED_DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: TRUSTED_DEVICE_LIFETIME_SECONDS,
};

export type TrustedDevice = {
  id: string;
  user_id: string;
  token_hash: string;
  device_label: string;
  user_agent_summary: string | null;
  created_at: string;
  expires_at: string;
  last_used_at: string;
  revoked_at: string | null;
};

export async function hashTrustedDeviceToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateTrustedDeviceToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function summarizeUserAgent(userAgent: string | null) {
  const value = userAgent || "";
  const browser = /Edg\//.test(value) ? "Edge" : /Chrome\//.test(value) ? "Chrome" : /Firefox\//.test(value) ? "Firefox" : /Safari\//.test(value) ? "Safari" : "Browser";
  const platform = /Windows/.test(value) ? "Windows" : /Android/.test(value) ? "Android" : /iPhone|iPad/.test(value) ? "iOS" : /Macintosh|Mac OS X/.test(value) ? "macOS" : /Linux/.test(value) ? "Linux" : "unknown platform";
  return `${browser} on ${platform}`;
}

export function isSensitiveAdminPath(pathname: string) {
  return pathname === "/admin/configuration/security"
    || pathname.startsWith("/admin/configuration/security/")
    || pathname === "/admin/mfa/recover"
    || pathname.startsWith("/admin/mfa/recover/")
    || pathname === "/admin/mfa/enroll"
    || pathname.startsWith("/admin/mfa/enroll/");
}

export async function findValidTrustedDevice(
  client: SupabaseClient,
  userId: string,
  rawToken: string | undefined,
  options: { now?: Date; touch?: boolean } = {},
) {
  if (!rawToken || !/^[a-f0-9]{64}$/.test(rawToken)) return null;
  try {
    const tokenHash = await hashTrustedDeviceToken(rawToken);
    const { data, error } = await client
      .from("admin_trusted_devices")
      .select("id,user_id,token_hash,device_label,user_agent_summary,created_at,expires_at,last_used_at,revoked_at")
      .eq("user_id", userId)
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error || !data || data.user_id !== userId || data.token_hash !== tokenHash || data.revoked_at) return null;

    const now = options.now ?? new Date();
    if (new Date(data.expires_at).getTime() <= now.getTime()) return null;

    if (options.touch !== false && now.getTime() - new Date(data.last_used_at).getTime() >= 15 * 60 * 1000) {
      await client.from("admin_trusted_devices").update({ last_used_at: now.toISOString() }).eq("id", data.id).eq("user_id", userId).is("revoked_at", null);
    }
    return data as TrustedDevice;
  } catch {
    return null;
  }
}
