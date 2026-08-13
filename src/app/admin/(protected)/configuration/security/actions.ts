"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSixDigitMfaCode } from "@/lib/auth/mfa";
import { getAdminUser } from "@/lib/supabase/server";

export type EnrollmentState = {
  message: string;
  enrollment?: { factorId: string; qrCode: string; secret: string };
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
  await admin.client.from("admin_audit_log").insert({ actor_id: admin.user.id, action: "mfa_enabled", entity_type: "admin_security", entity_id: admin.user.id, detail: { factorType: "totp" } });
  revalidatePath("/admin/configuration/security");
  redirect("/admin/configuration/security?enabled=success");
}

export async function removeMfaFactor(_: { message: string }, formData: FormData): Promise<{ message: string }> {
  const admin = await getAdminUser();
  if (!admin || !admin.mfaVerified) return { message: "Verify your account with two-factor authentication before removing it." };
  const factorId = String(formData.get("factorId") || "");
  const { data: factors, error: listError } = await admin.client.auth.mfa.listFactors();
  const factor = factors?.totp.find((item) => item.id === factorId);
  if (listError || !factor) return { message: "The authenticator could not be found. Refresh and try again." };
  const { error } = await admin.client.auth.mfa.unenroll({ factorId });
  if (error) return { message: "We couldn't remove the authenticator. Please verify your account and try again." };
  await admin.client.from("admin_audit_log").insert({ actor_id: admin.user.id, action: "mfa_removed", entity_type: "admin_security", entity_id: admin.user.id, detail: { factorType: "totp" } });
  revalidatePath("/admin/configuration/security");
  redirect("/admin/configuration/security?removed=success");
}
