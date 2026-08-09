import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminUser } from "@/lib/supabase/server";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");
  return <AdminShell displayName={admin.profile.display_name}>{children}</AdminShell>;
}
