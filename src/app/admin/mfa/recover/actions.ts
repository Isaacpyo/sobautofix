"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSixDigitMfaCode } from "@/lib/auth/mfa";
import {
  completeMfaRecovery,
  consumeMfaRecoveryCode,
  getActiveMfaRecoverySession,
  setMfaRecoveryNewFactor,
} from "@/lib/auth/mfa-recovery-server";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";

export type RecoveryCodeState = { message: string };
export type ReplacementEnrollmentState = {
  message: string;
  enrollment?: { factorId: string; qrCode: string; secret: string };
};

async function recoveryAttemptAllowed(userId: string) {
  const requestHeaders = await headers();
  const source = (requestHeaders.get("x-forwarded-for")?.split(",")[0] || requestHeaders.get("x-real-ip") || "unknown").trim().slice(0, 64);
  return await consumeRateLimit(`${userId}:${source}`, "admin_mfa_recovery_source", 5, 900)
    && await consumeRateLimit(userId, "admin_mfa_recovery_account", 12, 86_400);
}

export async function verifyMfaRecoveryCode(_: RecoveryCodeState, formData: FormData): Promise<RecoveryCodeState> {
  const admin = await getAdminUser({ requireMfa: false });
  const genericFailure = "The recovery code could not be verified. Check the code or wait before trying again.";
  if (!admin || admin.mfaVerified || !admin.mfaRequired) return { message: genericFailure };
  if (!(await recoveryAttemptAllowed(admin.user.id))) return { message: genericFailure };
  const code = String(formData.get("recoveryCode") || "");
  if (!(await consumeMfaRecoveryCode(admin.user.id, code))) return { message: genericFailure };
  redirect("/admin/mfa/recover?code=accepted");
}

export async function startAuthenticatorReplacement(
  _: ReplacementEnrollmentState,
  formData: FormData,
): Promise<ReplacementEnrollmentState> {
  void formData;
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin || admin.mfaVerified || !admin.mfaRequired) return { message: "The controlled recovery session is no longer valid. Sign in and start again." };
  const recovery = await getActiveMfaRecoverySession(admin.user.id);
  if (!recovery) return { message: "The controlled recovery session has expired. Enter another unused recovery code." };

  const { data: existingFactors, error: listError } = await admin.client.auth.mfa.listFactors();
  if (listError || !existingFactors) return { message: "The authenticator replacement could not be started. Try again." };
  if (recovery.new_factor_id) {
    const previousAttempt = existingFactors.all.find((factor) => factor.id === recovery.new_factor_id);
    if (previousAttempt?.status === "verified") return { message: "The replacement authenticator is already verified. Enter its current code below to finish secure cleanup." };
    if (previousAttempt?.status === "unverified") {
      const { error } = await admin.client.auth.mfa.unenroll({ factorId: previousAttempt.id });
      if (error) return { message: "An incomplete replacement could not be cleared. Wait for the recovery session to expire and try again." };
    }
  }

  const { data, error } = await admin.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "SOB Autofix Admin Replacement" });
  if (error || !data || data.type !== "totp") return { message: "The replacement authenticator could not be started. Try again." };
  if (!(await setMfaRecoveryNewFactor(admin.user.id, recovery.id, data.id))) {
    await admin.client.auth.mfa.unenroll({ factorId: data.id });
    return { message: "The controlled recovery session expired before setup completed. Enter another unused recovery code." };
  }
  return { message: "", enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyAuthenticatorReplacement(
  _: ReplacementEnrollmentState,
  formData: FormData,
): Promise<ReplacementEnrollmentState> {
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin || !admin.mfaRequired) return { message: "The controlled recovery session is no longer valid. Sign in and start again." };
  const recovery = await getActiveMfaRecoverySession(admin.user.id);
  if (!recovery?.new_factor_id) return { message: "Start replacement authenticator setup again." };
  const factorId = String(formData.get("factorId") || "");
  const code = String(formData.get("code") || "").replace(/\s/g, "");
  if (factorId !== recovery.new_factor_id || !isSixDigitMfaCode(code)) return { message: "Enter the 6-digit code from the replacement authenticator." };
  if (!(await consumeRateLimit(admin.user.id, "admin_mfa_recovery_totp", 6, 300))) return { message: "Too many verification attempts. Wait before trying again." };

  const { data: factors, error: listError } = await admin.client.auth.mfa.listFactors();
  const replacement = factors?.all.find((factor) => factor.id === factorId && factor.factor_type === "totp");
  if (listError || !replacement) return { message: "The replacement setup has expired. Start it again." };
  const { error: verifyError } = await admin.client.auth.mfa.challengeAndVerify({ factorId, code });
  if (verifyError) return { message: "That verification code is incorrect or has expired." };
  const { data: assurance } = await admin.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return { message: "The replacement was not confirmed at the required security level. Try again." };

  const service = createAdminClient();
  if (!service) return { message: "The trusted recovery service is unavailable. Try again later." };
  const { data: serviceFactors, error: serviceListError } = await service.auth.admin.mfa.listFactors({ userId: admin.user.id });
  const verifiedReplacement = serviceFactors?.factors.find((factor) => factor.id === factorId && factor.status === "verified" && factor.factor_type === "totp");
  if (serviceListError || !verifiedReplacement) return { message: "The replacement authenticator could not be confirmed. Try again." };

  const existingFactorIds = new Set(serviceFactors.factors.map((factor) => factor.id));
  for (const oldFactorId of recovery.old_factor_ids.filter((id) => id !== factorId && existingFactorIds.has(id))) {
    const { error } = await service.auth.admin.mfa.deleteFactor({ userId: admin.user.id, id: oldFactorId });
    if (error) return { message: "The new authenticator works, but secure removal of the old factor is incomplete. Submit a fresh code from the new authenticator to retry cleanup." };
  }
  if (!(await completeMfaRecovery(admin.user.id, recovery.id, factorId))) {
    return { message: "The authenticator was replaced, but recovery completion could not be recorded. Contact the project owner before continuing." };
  }
  await service.from("admin_audit_log").insert({ actor_id: admin.user.id, action: "global_sign_out", entity_type: "admin_security", entity_id: admin.user.id, detail: { reason: "mfa_factor_replaced" } });
  const { error: signOutError } = await admin.client.auth.signOut({ scope: "global" });
  if (signOutError) await admin.client.auth.signOut({ scope: "local" });
  redirect("/admin/login?mfa=replaced");
}
