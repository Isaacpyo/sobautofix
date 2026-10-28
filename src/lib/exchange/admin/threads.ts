import "server-only";

import type { StaffClient } from "./core";

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  message_type: string;
  sender_name: string | null;
  text_body: string;
  delivery_status: string;
  created_at: string;
};

/** The enquiry's email thread, newest first, with the original message for older enquiries. */
export async function loadThread(client: StaffClient, enquiryId: string): Promise<ThreadMessage[]> {
  const [messages, enquiry] = await Promise.all([
    client.from("enquiry_messages").select("id,direction,message_type,sender_name,text_body,delivery_status,created_at").eq("enquiry_id", enquiryId).order("created_at", { ascending: false }).order("id", { ascending: false }),
    client.from("enquiries").select("id,description,created_at,customers(name)").eq("id", enquiryId).maybeSingle(),
  ]);
  const stored = (messages.data || []) as ThreadMessage[];
  const row = enquiry.data as { id: string; description: string | null; created_at: string; customers: { name: string } | null } | null;
  if (!row?.description || stored.some((message) => message.message_type === "website_enquiry")) return stored;
  return [...stored, { id: `original-${row.id}`, direction: "inbound", message_type: "website_enquiry", sender_name: row.customers?.name || "Customer", text_body: row.description, delivery_status: "received", created_at: row.created_at }];
}
