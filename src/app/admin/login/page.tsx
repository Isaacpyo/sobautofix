import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { getAdminUser } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await getAdminUser()) redirect("/admin");
  return <section className="hero-grid grid min-h-screen place-items-center p-5"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"><Logo /><h1 className="mt-9 text-4xl font-extrabold text-[#071127]">Staff sign in</h1><p className="mt-3 text-sm leading-6 text-[#586575]">Only invited accounts listed as administrators can access the CMS.</p><LoginForm /></div></section>;
}
