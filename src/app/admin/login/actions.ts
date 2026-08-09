"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_EMAIL } from "@/config/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { message: string };

export async function loginWithPassword(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.string().min(1).max(1_024).safeParse(formData.get("password"));
  if (!parsed.success) return { message: "Enter your password." };
  const client = await createClient();
  if (!client) return { message: "Supabase authentication is not configured." };

  const { data: auth, error } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: parsed.data,
  });
  if (error || !auth.user) return { message: "Sign-in failed. Check your password and try again." };

  const { data: profile } = await client
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!profile) {
    await client.auth.signOut();
    return { message: "This account is not authorised for the CMS." };
  }

  redirect("/admin");
}

export async function signOut() {
  const client = await createClient();
  await client?.auth.signOut();
  redirect("/admin/login");
}
