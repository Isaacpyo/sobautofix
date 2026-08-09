import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { createClient, getAdminUser } from "@/lib/supabase/server";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");
  const client = await createClient();
  const { count } = client
    ? await client.from("enquiries").select("id", { count: "exact", head: true }).or("status.eq.new,notification_status.in.(pending,failed)")
    : { count: 0 };
  return <AdminShell displayName={admin.profile.display_name} notificationCount={count ?? 0}>{children}</AdminShell>;
}
