import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { createClient, getAdminUser } from "@/lib/supabase/server";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser({ requireMfa: false });
  if (!admin) redirect("/admin/login");
  if (admin.mfaRequired && !admin.mfaVerified) redirect("/admin/mfa");
  const client = await createClient();
  const [enquiryAlerts, unreadThreads, unmatchedInbound] = client ? await Promise.all([
    client.from("enquiries").select("id").or("status.eq.new,notification_status.in.(pending,failed)"),
    client.from("enquiry_conversations").select("enquiry_id").gt("unread_count", 0),
    client.from("unmatched_inbound_emails").select("id", { count: "exact", head: true }).is("linked_enquiry_id", null).neq("reason", "automated_ignored"),
  ]) : [{ data: [] }, { data: [] }, { count: 0 }];
  const attentionIds = new Set([...(enquiryAlerts.data || []).map((item) => item.id), ...(unreadThreads.data || []).map((item) => item.enquiry_id)]);
  return <AdminShell displayName={admin.profile.display_name} notificationCount={attentionIds.size + (unmatchedInbound.count || 0)}>{children}</AdminShell>;
}
