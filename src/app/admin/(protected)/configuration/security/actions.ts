"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSixDigitMfaCode } from "@/lib/auth/mfa";
import { isMandatoryAdminMfaEnabled } from "@/lib/auth/mfa-policy";
import { createMfaRecoveryCodeSet, revokeMfaRecoveryMaterial } from "@/lib/auth/mfa-recovery-server";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import { clearTrustedDeviceCookie, getCurrentTrustedDevice, revokeAllTrustedDevices } from "@/lib/auth/trusted-device-server";

export type EnrollmentState = {
  message: string;
  enrollment?: { factorId: string; qrCode: string; secret: string };
  recoveryCodes?: string[];
};

export async function startMfaEnrollment(previous: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  void previous;
  void formData;
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin) return { message: "Your admin session has expired. Sign in again." };
  const { data: factors, error: listError } = await admin.client.auth.mfa.listFactors();
  if (listError || !factors) return { message: "We couldn't start two-factor authentication. Please try again." };
  if (factors.totp.length > 0) return { message: "An authenticator is already enabled for this account." };

  for (const factor of factors.all.filter((item) => item.factor_type === "totp" && item.status === "unverified")) {
    const { error } = await admin.client.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { message: "We couldn't clean up an incomplete setup. Please try again." };
  }

  const { data, error } = await admin.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "SOB Autofix Admin" });
  if (error || !data || data.type !== "totp") return { message: "We couldn't enable two-factor authentication. Please try again." };
  return { message: "", enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyMfaEnrollment(_: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin) return { message: "Your admin session has expired. Sign in again." };
  const factorId = String(formData.get("factorId") || "");
  const code = String(formData.get("code") || "").replace(/\s/g, "");
  if (!isSixDigitMfaCode(code)) return { message: "Enter the 6-digit code from your authenticator app." };
  if (!(await consumeRateLimit(admin.user.id, "admin_mfa_enrollment", 6, 300))) return { message: "Too many verification attempts. Please wait before trying again." };
  const { data: factors, error: listError } = await admin.client.auth.mfa.listFactors();
  const factor = factors?.all.find((item) => item.id === factorId && item.factor_type === "totp" && item.status === "unverified");
  if (listError || !factor) return { message: "This setup has expired. Start authenticator setup again." };
  const { error } = await admin.client.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { message: "That verification code is incorrect or has expired." };
  const { data: assurance } = await admin.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return { message: "The authenticator was verified, but the secure session could not be confirmed. Sign in again before continuing." };
  const recoveryCodes = await createMfaRecoveryCodeSet(admin.user.id, "mfa_recovery_codes_created");
  if (!recoveryCodes) {
    await revokeAllTrustedDevices(admin.user.id, "mfa_trusted_devices_revoked_factor_change");
    return { message: "Two-factor authentication is enabled, but recovery codes could not be created. Sign in again and create them from Security before relying on MFA recovery." };
  }
  await admin.client.from("admin_audit_log").insert({ actor_id: admin.user.id, action: "mfa_enabled", entity_type: "admin_security", entity_id: admin.user.id, detail: { factorType: "totp" } });
  revalidatePath("/admin/configuration/security");
  return { message: "", recoveryCodes };
}

export async function regenerateMfaRecoveryCodes(
  _: { message: string; recoveryCodes?: string[] },
  formData: FormData,
): Promise<{ message: string; recoveryCodes?: string[] }> {
  void formData;
  const admin = await getAdminUser();
  if (!admin?.mfaVerified) return { message: "Verify with your authenticator before creating recovery codes." };
  if (!(await consumeRateLimit(admin.user.id, "admin_mfa_recovery_regeneration", 3, 900))) {
    return { message: "Too many recovery-code changes. Please wait before trying again." };
  }
  const recoveryCodes = await createMfaRecoveryCodeSet(admin.user.id, "mfa_recovery_codes_regenerated");
  if (!recoveryCodes) return { message: "Recovery codes could not be created securely. Try again later." };
  revalidatePath("/admin/configuration/security");
  return { message: "", recoveryCodes };
}

export async function removeMfaFactor(_: { message: string }, formData: FormData): Promise<{ message: string }> {
  const admin = await getAdminUser();
  if (!admin || !admin.mfaVerified) return { message: "Verify your account with two-factor authentication before removing it." };
  const factorId = String(formData.get("factorId") || "");
  const { data: factors, error: listError } = await admin.client.auth.mfa.listFactors();
  const factor = factors?.totp.find((item) => item.id === factorId);
  if (listError || !factor) return { message: "The authenticator could not be found. Refresh and try again." };
  const service = createAdminClient();
  if (await isMandatoryAdminMfaEnabled(service) && (factors?.totp.length ?? 0) <= 1) {
    return { message: "Mandatory MFA is enabled. Replace this authenticator through the recovery flow instead of removing the account's only factor." };
  }
  if (!(await revokeAllTrustedDevices(admin.user.id, "mfa_trusted_devices_revoked_factor_removed"))) {
    return { message: "Trusted devices could not be revoked, so the authenticator was not removed." };
  }
  const { error } = await admin.client.auth.mfa.unenroll({ factorId });
  if (error) return { message: "We couldn't remove the authenticator. Please verify your account and try again." };
  if (!(await revokeMfaRecoveryMaterial(admin.user.id, "mfa_factor_removed"))) {
    return { message: "The authenticator was removed, but recovery records could not be revoked. Contact the project owner before continuing." };
  }
  await admin.client.from("admin_audit_log").insert({ actor_id: admin.user.id, action: "mfa_removed", entity_type: "admin_security", entity_id: admin.user.id, detail: { factorType: "totp" } });
  revalidatePath("/admin/configuration/security");
  redirect("/admin/configuration/security?removed=success");
}

export async function revokeTrustedDevice(_: { message: string }, formData: FormData) {
  const admin = await getAdminUser();
  if (!admin?.mfaVerified) return { message: "Verify with your authenticator before revoking a trusted device." };
  const deviceId = String(formData.get("deviceId") || "");
  const client = createAdminClient();
  if (!client || !deviceId) return { message: "The trusted device could not be revoked." };
  const current = await getCurrentTrustedDevice(admin.user.id, { touch: false });
  const revokedAt = new Date().toISOString();
  const { data, error } = await client.from("admin_trusted_devices").update({ revoked_at: revokedAt }).eq("id", deviceId).eq("user_id", admin.user.id).is("revoked_at", null).select("id,device_label").maybeSingle();
  if (error || !data) return { message: "The trusted device was already revoked or could not be found." };
  await client.from("admin_audit_log").insert({ actor_id: admin.user.id, action: "mfa_trusted_device_revoked", entity_type: "admin_trusted_device", entity_id: data.id, detail: { deviceLabel: data.device_label } });
  if (current?.id === data.id) await clearTrustedDeviceCookie();
  revalidatePath("/admin/configuration/security");
  return { message: "Trusted device revoked." };
}

export async function revokeEveryTrustedDevice(previous: { message: string }, formData: FormData) {
  void previous;
  void formData;
  const admin = await getAdminUser();
  if (!admin?.mfaVerified) return { message: "Verify with your authenticator before revoking trusted devices." };
  if (!(await revokeAllTrustedDevices(admin.user.id))) return { message: "Trusted devices could not be revoked." };
  revalidatePath("/admin/configuration/security");
  return { message: "All trusted devices revoked." };
}
