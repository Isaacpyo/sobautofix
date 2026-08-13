import { redirect } from "next/navigation";
import { signOut } from "@/app/admin/login/actions";
import { MfaSecurityPanel } from "@/app/admin/(protected)/configuration/security/mfa-security-panel";
import { Logo } from "@/components/layout/logo";
import { getAdminUser } from "@/lib/supabase/server";

export default async function MandatoryMfaEnrollmentPage() {
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin) redirect("/admin/login");
  if (admin.mfaVerified) redirect("/admin");
  if (admin.mfaRequired) redirect("/admin/mfa");
  return <section className="hero-grid min-h-screen p-5 sm:p-8"><div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-7 shadow-2xl sm:p-9"><Logo /><p className="mt-8 text-xs font-extrabold tracking-[0.16em] text-[#1974E2] uppercase">Restricted security setup</p><h1 className="mt-2 text-3xl font-extrabold text-[#071127]">Protect the administrator account</h1><p className="mt-3 text-sm leading-6 text-[#586575]">This route exposes only authenticator enrollment and one-time recovery-code setup. No enquiries, invoices, bookings, inventory or configuration data is available here.</p><div className="mt-7"><MfaSecurityPanel /></div><form action={signOut} className="mt-5"><button className="min-h-11 w-full text-sm font-bold text-[#586575] hover:text-[#1974E2]">Use another account</button></form></div></section>;
}
