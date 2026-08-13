import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { signOut } from "@/app/admin/login/actions";
import { getActiveMfaRecoverySession } from "@/lib/auth/mfa-recovery-server";
import { getAdminUser } from "@/lib/supabase/server";
import { AuthenticatorReplacementForm, RecoveryCodeForm } from "./mfa-recovery-flow";

export default async function MfaRecoveryPage() {
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin) redirect("/admin/login");
  const recovery = await getActiveMfaRecoverySession(admin.user.id);
  if (admin.mfaVerified && !recovery) redirect("/admin");
  if (!admin.mfaRequired && !recovery) redirect("/admin/mfa/enroll");
  return <section className="hero-grid grid min-h-screen place-items-center p-5"><div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"><Logo /><p className="mt-8 text-xs font-extrabold tracking-[0.16em] text-[#1974E2] uppercase">Controlled MFA recovery</p><h1 className="mt-2 text-3xl font-extrabold text-[#071127]">{recovery ? "Replace your authenticator" : "Lost your authenticator?"}</h1><p className="mt-3 text-sm leading-6 text-[#586575]">{recovery ? "Your recovery code has been consumed. The old factor remains active until a new authenticator is verified, then all other sessions and remembered devices are revoked." : "First sign in to the administrator account, then enter one unused recovery code. Email access alone cannot remove or replace MFA."}</p>{recovery ? <AuthenticatorReplacementForm existingFactorId={recovery.new_factor_id} /> : <RecoveryCodeForm />}<form action={signOut} className="mt-5"><button className="min-h-11 w-full text-sm font-bold text-[#586575] hover:text-[#1974E2]">Cancel and use another account</button></form></div></section>;
}

