import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser({ requireMfa: false, allowTrustedDevice: true });
  if (!admin) redirect("/admin/login");
  if (admin.mfaState === "enrollment_required") redirect("/admin/mfa/enroll");
  if (admin.mfaState === "challenge_required") redirect("/admin/mfa");
  const client = createAdminClient();
  const [enquiryAlerts, unreadThreads, unmatchedInbound, repliedEnquiries] = client ? await Promise.all([
    client.from("enquiries").select("id,status,notification_status").or("status.eq.new,notification_status.in.(pending,failed)"),
    client.from("enquiry_conversations").select("enquiry_id").gt("unread_count", 0),
    client.from("unmatched_inbound_emails").select("id", { count: "exact", head: true }).is("linked_enquiry_id", null).is("ignored_at", null).neq("reason", "automated_ignored"),
    client.from("enquiry_messages").select("enquiry_id").eq("direction", "outbound").eq("message_type", "email").in("delivery_status", ["sent", "delivered"]),
  ]) : [{ data: [] }, { data: [] }, { count: 0 }, { data: [] }];
  const repliedIds = new Set((repliedEnquiries.data || []).map((item) => item.enquiry_id));
  const actionableEnquiryIds = (enquiryAlerts.data || [])
    .filter((item) => item.status !== "new" || !repliedIds.has(item.id) || ["pending", "failed"].includes(item.notification_status))
    .map((item) => item.id);
  const attentionIds = new Set([...actionableEnquiryIds, ...(unreadThreads.data || []).map((item) => item.enquiry_id)]);
  return <AdminShell displayName={admin.profile.display_name} notificationCount={attentionIds.size + (unmatchedInbound.count || 0)}>{children}</AdminShell>;
}
