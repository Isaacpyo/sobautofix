"use server";

import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSixDigitMfaCode, safeAdminReturnTo } from "@/lib/auth/mfa";
import { getAdminUser } from "@/lib/supabase/server";
import { trustCurrentDevice } from "@/lib/auth/trusted-device-server";

export type MfaChallengeState = { message: string };

export async function verifyMfaChallenge(_: MfaChallengeState, formData: FormData): Promise<MfaChallengeState> {
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin) return { message: "Your sign-in session has expired. Use another account and try again." };
  const code = String(formData.get("code") || "").replace(/\s/g, "");
  const factorId = String(formData.get("factorId") || "");
  if (!isSixDigitMfaCode(code)) return { message: "Enter the 6-digit code from your authenticator app." };
  if (!(await consumeRateLimit(admin.user.id, "admin_mfa_challenge", 6, 300))) {
    return { message: "Too many verification attempts. Please wait before trying again." };
  }
  const { data: factors, error: factorsError } = await admin.client.auth.mfa.listFactors();
  const factor = factors?.totp.find((item) => item.id === factorId);
  if (factorsError || !factor) return { message: "The authenticator could not be verified. Sign in again and retry." };
  const { error } = await admin.client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { message: "That verification code is incorrect or has expired." };
  if (formData.get("trustDevice") === "yes") await trustCurrentDevice(admin.user.id);
  redirect(safeAdminReturnTo(formData.get("returnTo")));
}
