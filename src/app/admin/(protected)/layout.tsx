import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminNotificationSummary } from "@/lib/admin/notifications";
import { getAdminUser } from "@/lib/supabase/server";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser({ requireMfa: false, allowTrustedDevice: true });
  if (!admin) redirect("/admin/login");
  if (admin.mfaState === "enrollment_required") redirect("/admin/mfa/enroll");
  if (admin.mfaState === "challenge_required") redirect("/admin/mfa");
  const notifications = await getAdminNotificationSummary();
  return <AdminShell displayName={admin.profile.display_name} notificationCount={notifications.count}>{children}</AdminShell>;
}
