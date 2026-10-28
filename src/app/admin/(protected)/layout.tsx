import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminNotificationSummary } from "@/lib/admin/notifications";
import { getStaffRole } from "@/lib/exchange/staff";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";

// Lets the mobile bottom navigation pad itself above the home indicator.
export const viewport: Viewport = { viewportFit: "cover" };

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser({ requireMfa: false, allowTrustedDevice: true });
  if (!admin) redirect("/admin/login");
  if (admin.mfaState === "enrollment_required") redirect("/admin/mfa/enroll");
  if (admin.mfaState === "challenge_required") redirect("/admin/mfa");
  const client = createAdminClient();
  const [notifications, role] = await Promise.all([
    getAdminNotificationSummary(),
    client ? getStaffRole(client, admin.user.id) : Promise.resolve("owner" as const),
  ]);
  return <AdminShell displayName={admin.profile.display_name} notificationCount={notifications.count} role={role}>{children}</AdminShell>;
}
