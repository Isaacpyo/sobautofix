"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedAdminEmail } from "@/config/admin";
import { siteConfig } from "@/config/site";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { getCurrentTrustedDevice, revokeAllTrustedDevices } from "@/lib/auth/trusted-device-server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type LoginState = { message: string };

export async function loginWithPassword(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.object({
    email: z.email(),
    password: z.string().min(1).max(1_024),
  }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { message: "Enter your email address and password." };
  if (!isAllowedAdminEmail(parsed.data.email)) return { message: "Sign-in failed. Check your details and try again." };
  const client = await createClient();
  if (!client) return { message: "Supabase authentication is not configured." };

  const { data: auth, error } = await client.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  });
  if (error || !auth.user) return { message: "Sign-in failed. Check your password and try again." };

  const profileClient = createAdminClient();
  if (!profileClient) {
    await client.auth.signOut();
    return { message: "Supabase authentication is not configured." };
  }
  const { data: profile } = await profileClient
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!profile) {
    await client.auth.signOut();
    return { message: "This account is not authorised for the CMS." };
  }

  const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance) {
    await client.auth.signOut();
    return { message: "We couldn't verify the account security status. Please try again." };
  }
  const trustedDevice = requiresMfaChallenge(assurance) ? await getCurrentTrustedDevice(auth.user.id) : null;
  redirect(requiresMfaChallenge(assurance) && !trustedDevice ? "/admin/mfa" : "/admin");
}

export async function requestPasswordReset(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.object({ email: z.email() }).safeParse({ email: formData.get("email") });
  const genericMessage = "If that address belongs to the authorised administrator, a password reset link has been sent.";
  if (!parsed.success || !isAllowedAdminEmail(parsed.data.email)) return { message: genericMessage };

  const client = await createClient();
  if (!client) return { message: "Password recovery is not configured." };
  const redirectTo = new URL("/auth/confirm?next=/admin/reset-password", siteConfig.siteUrl).toString();
  const { error } = await client.auth.resetPasswordForEmail(parsed.data.email.trim().toLowerCase(), { redirectTo });
  return { message: error ? "We couldn't send the reset email. Please try again shortly." : genericMessage };
}

export async function resetAdminPassword(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.object({
    password: z.string().min(12, "Use at least 12 characters.").max(1_024),
    confirmPassword: z.string().max(1_024),
  }).refine((value) => value.password === value.confirmPassword, { message: "The passwords do not match.", path: ["confirmPassword"] }).safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message || "Check the new password and try again." };

  const client = await createClient();
  if (!client) return { message: "Password recovery is not configured." };
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email || !isAllowedAdminEmail(user.email)) return { message: "This reset link is invalid or has expired. Request a new link." };
  const profileClient = createAdminClient();
  const { data: profile } = profileClient ? await profileClient.from("admin_profiles").select("user_id").eq("user_id", user.id).maybeSingle() : { data: null };
  if (!profile) return { message: "This account is not authorised for the CMS." };

  if (!(await revokeAllTrustedDevices(user.id, "mfa_trusted_devices_revoked_password_change"))) {
    return { message: "The password could not be updated securely. Request a new reset link and try again." };
  }
  const { error } = await client.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: "The password could not be updated. Request a new reset link and try again." };
  await client.auth.signOut();
  redirect("/admin/login?reset=success");
}

export async function signOut() {
  const client = await createClient();
  await client?.auth.signOut();
  redirect("/admin/login");
}
