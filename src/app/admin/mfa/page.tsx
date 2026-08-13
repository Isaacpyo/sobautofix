import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { signOut } from "@/app/admin/login/actions";
import { safeAdminReturnTo } from "@/lib/auth/mfa";
import { getAdminUser } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./mfa-challenge-form";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeAdminReturnTo((await searchParams).returnTo);
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin) redirect("/admin/login");
  if (!admin.mfaRequired || admin.mfaVerified) redirect(returnTo);
  const { data, error } = await admin.client.auth.mfa.listFactors();
  const factor = data?.totp[0];
  if (error || !factor) return <section className="hero-grid grid min-h-screen place-items-center p-5"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"><Logo /><h1 className="mt-8 text-3xl font-extrabold text-[#071127]">Authenticator unavailable</h1><p className="mt-3 text-sm leading-6 text-[#586575]">A supported TOTP authenticator could not be found for this account. Use another account or contact the Supabase project owner.</p><form action={signOut} className="mt-6"><button className="min-h-12 w-full rounded-lg bg-[#1974E2] px-5 text-sm font-bold text-white">Use another account</button></form></div></section>;
  return <section className="hero-grid grid min-h-screen place-items-center p-5"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"><Logo /><p className="mt-8 text-xs font-extrabold tracking-[0.16em] text-[#1974E2] uppercase">Secure sign in</p><h1 className="mt-2 text-3xl font-extrabold text-[#071127]">Two-factor authentication</h1><p className="mt-3 text-sm leading-6 text-[#586575]">Enter the 6-digit verification code from your authenticator app.</p><MfaChallengeForm factorId={factor.id} returnTo={returnTo} /></div></section>;
}
