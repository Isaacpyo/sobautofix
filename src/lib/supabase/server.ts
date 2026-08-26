import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isAllowedAdminEmail } from "@/config/admin";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { isMandatoryAdminMfaEnabled } from "@/lib/auth/mfa-policy";
import { findValidTrustedDevice, TRUSTED_DEVICE_COOKIE } from "@/lib/auth/trusted-device";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;

  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  return createSupabaseClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createAdminReadClient() {
  const admin = await getAdminUser({ allowTrustedDevice: true });
  if (!admin || (admin.mfaRequired && !admin.mfaVerified && !admin.trustedDevice)) return null;
  return createAdminClient();
}

export async function getAdminUser(options: { requireMfa?: boolean; allowTrustedDevice?: boolean } = {}) {
  const requireMfa = options.requireMfa ?? true;
  const client = await createClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user || !isAllowedAdminEmail(user.email)) return null;

  const profileClient = createAdminClient();
  if (!profileClient) return null;
  const { data: profile } = await profileClient
    .from("admin_profiles")
    .select("user_id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return null;
  const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance) return null;
  const mfaRequired = assurance.nextLevel === "aal2";
  const mfaVerified = assurance.currentLevel === "aal2";
  const mandatoryMfa = await isMandatoryAdminMfaEnabled(profileClient);
  let trustedDevice = null;
  if (options.allowTrustedDevice && requiresMfaChallenge(assurance)) {
    const rawToken = (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;
    trustedDevice = await findValidTrustedDevice(profileClient, user.id, rawToken);
  }
  if (requireMfa && requiresMfaChallenge(assurance) && !trustedDevice) return null;
  if (requireMfa && mandatoryMfa && !mfaRequired && !mfaVerified) return null;
  const mfaState = mfaVerified
    ? "verified"
    : requiresMfaChallenge(assurance)
      ? trustedDevice ? "trusted" : "challenge_required"
      : mandatoryMfa ? "enrollment_required" : "unenrolled_allowed";
  return { user, profile, client, assurance, mfaRequired, mfaVerified, mandatoryMfa, mfaState, trustedDevice };
}
