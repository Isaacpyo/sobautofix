"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";

export type LoginState = { message: string };

export async function requestLogin(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { message: "Enter a valid staff email address." };
  const client = await createClient();
  if (!client) return { message: "Supabase authentication is not configured." };
  const { error } = await client.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteConfig.siteUrl}/auth/confirm` },
  });
  if (error) return { message: "A sign-in link could not be sent. Confirm that this address has been invited." };
  return { message: "Check your email for a secure sign-in link." };
}

export async function signOut() {
  const client = await createClient();
  await client?.auth.signOut();
  redirect("/admin/login");
}
