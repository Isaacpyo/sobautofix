import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

export type AdminNotificationSummary = {
  count: number;
  enquiryCount: number;
  bookingCount: number;
  unmatchedCount: number;
};

export async function getAdminNotificationSummary(): Promise<AdminNotificationSummary> {
  const client = createAdminClient();
  if (!client) return { count: 0, enquiryCount: 0, bookingCount: 0, unmatchedCount: 0 };

  const [enquiryAlerts, unreadThreads, unmatchedInbound, repliedEnquiries, bookingAlerts, bookingDeliveryAlerts] = await Promise.all([
    client.from("enquiries").select("id,status,notification_status").or("status.eq.new,notification_status.in.(pending,failed)"),
    client.from("enquiry_conversations").select("enquiry_id").gt("unread_count", 0),
    client.from("unmatched_inbound_emails").select("id", { count: "exact", head: true }).is("linked_enquiry_id", null).is("ignored_at", null).neq("reason", "automated_ignored"),
    client.from("enquiry_messages").select("enquiry_id").eq("direction", "outbound").eq("message_type", "email").in("delivery_status", ["sent", "delivered"]),
    client.from("bookings").select("id").or("admin_seen_at.is.null,provider_sync_state.in.(pending,failed)"),
    client.from("booking_notification_events").select("booking_id").in("status", ["pending", "failed"]),
  ]);

  const repliedIds = new Set((repliedEnquiries.data || []).map((item) => item.enquiry_id));
  const enquiryIds = new Set([
    ...(enquiryAlerts.data || [])
      .filter((item) => item.status !== "new" || !repliedIds.has(item.id) || ["pending", "failed"].includes(item.notification_status))
      .map((item) => item.id),
    ...(unreadThreads.data || []).map((item) => item.enquiry_id),
  ]);
  const bookingIds = new Set([
    ...(bookingAlerts.data || []).map((item) => item.id),
    ...(bookingDeliveryAlerts.data || []).map((item) => item.booking_id),
  ]);
  const unmatchedCount = unmatchedInbound.count || 0;

  return {
    count: enquiryIds.size + bookingIds.size + unmatchedCount,
    enquiryCount: enquiryIds.size,
    bookingCount: bookingIds.size,
    unmatchedCount,
  };
}
