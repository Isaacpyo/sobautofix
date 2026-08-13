import "server-only";

import { z } from "zod";
import { getResendConfig, getResendReplyConfig, retrieveReceivedEmail, retrieveSentEmail, sendTransactionalEmail } from "@/lib/email/resend";
import { renderEnquiryReply } from "@/lib/email/templates/enquiries";
import { createAdminClient } from "@/lib/supabase/server";
import {
  buildEnquiryReplyAddress,
  conversationSubject,
  extractMessageIds,
  headerValue,
  isAutomatedEmail,
  parseSenderEmail,
  resolveInboundThread,
  safeInboundText,
} from "./email-threading";
import { getEnquiryReplyDomain } from "./inbound-config";
import type { NormalizedInboundEmail } from "./inbound-email";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type ReplyState = { status: "idle" | "sent" | "error"; message: string; draft: string; clientRequestId: string };

export async function createInitialEnquiryMessage(enquiryId: string, input: { type: string; customerName: string; customerEmail?: string; description: string; createdAt?: string }) {
  const admin = requireServiceClient();
  const conversation = await ensureConversation(admin, enquiryId, input.type);
  const { error } = await admin.from("enquiry_messages").insert({
    enquiry_id: enquiryId,
    direction: "inbound",
    message_type: "website_enquiry",
    sender_name: input.customerName,
    sender_email: input.customerEmail || null,
    recipient_email: null,
    subject: conversation.subject,
    text_body: input.description,
    delivery_status: "received",
    is_read: false,
    created_at: input.createdAt || new Date().toISOString(),
  });
  if (error) throw new Error("Could not create the enquiry conversation");
  await admin.from("enquiry_conversations").update({ unread_count: 1, last_activity_at: input.createdAt || new Date().toISOString() }).eq("enquiry_id", enquiryId);
}

export async function getEnquiryReplyAddress(enquiryId: string, enquiryType: string) {
  const admin = requireServiceClient();
  const conversation = await ensureConversation(admin, enquiryId, enquiryType);
  const replyConfig = getResendReplyConfig();
  return replyConfig ? buildEnquiryReplyAddress(conversation.reply_token, replyConfig.inboundDomain) : null;
}

export async function sendEnquiryReply(input: { enquiryId: string; body: string; clientRequestId: string; actorId: string; actorName: string }) {
  const parsed = z.object({ enquiryId: z.string().uuid(), body: z.string().trim().min(1).max(20000), clientRequestId: z.string().uuid(), actorId: z.string().uuid(), actorName: z.string().trim().min(1).max(100) }).parse(input);
  const admin = requireServiceClient();
  const { data, error } = await admin.from("enquiries").select("id,type,status,customers(name,email)").eq("id", parsed.enquiryId).single();
  if (error || !data) throw new Error("Enquiry could not be loaded");
  const enquiry = data as unknown as { id: string; type: string; status: string; customers: { name: string; email: string | null } | null };
  if (!enquiry.customers?.email) throw new Error("This customer does not have an email address");
  const conversation = await ensureConversation(admin, enquiry.id, enquiry.type);
  const emailConfig = getResendConfig();
  if (!emailConfig) throw new Error("Transactional email is not configured");
  const replyConfig = getResendReplyConfig();
  const replyTo = replyConfig ? buildEnquiryReplyAddress(conversation.reply_token, replyConfig.inboundDomain) : emailConfig.replyTo;
  const { data: previous } = await admin.from("enquiry_messages").select("message_id,reference_ids").eq("enquiry_id", enquiry.id).not("message_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const inReplyTo = previous?.message_id || null;
  const references = [...new Set([...(previous?.reference_ids || []), ...(inReplyTo ? [inReplyTo] : [])])].slice(-50);
  const messageRow = {
    enquiry_id: enquiry.id, direction: "outbound", message_type: "email", sender_name: parsed.actorName,
    sender_email: emailConfig.from, recipient_email: enquiry.customers.email, subject: conversation.subject,
    text_body: parsed.body, provider: "resend", in_reply_to: inReplyTo, reference_ids: references,
    delivery_status: "sending", is_read: true, client_request_id: parsed.clientRequestId, created_by: parsed.actorId,
  };
  const { data: prepared, error: insertError } = await admin.from("enquiry_messages").insert(messageRow).select("id,provider_email_id,delivery_status").single();
  let inserted = prepared;
  if (insertError?.code === "23505") {
    const { data: existing } = await admin.from("enquiry_messages").select("id,provider_email_id,delivery_status,text_body").eq("enquiry_id", enquiry.id).eq("client_request_id", parsed.clientRequestId).single();
    if (existing?.provider_email_id && ["sent", "delivered"].includes(existing.delivery_status)) return existing;
    if (existing?.delivery_status === "failed" && existing.text_body === parsed.body) {
      const { error: retryError } = await admin.from("enquiry_messages").update({ delivery_status: "sending" }).eq("id", existing.id);
      if (retryError) throw new Error("The failed reply could not be prepared for retry");
      inserted = existing;
    } else {
      throw new Error("This reply is already being processed. Refresh before retrying.");
    }
  }
  if (!inserted || (insertError && insertError.code !== "23505")) throw new Error("The reply could not be prepared");

  try {
    const headers = inReplyTo ? { "In-Reply-To": inReplyTo, References: references.join(" ") } : undefined;
    const rendered = renderEnquiryReply({ customerName: enquiry.customers.name, body: parsed.body });
    const result = await sendTransactionalEmail({
      to: enquiry.customers.email,
      subject: conversation.subject,
      text: rendered.text,
      html: rendered.html,
      replyTo,
      headers,
      idempotencyKey: `enquiry-reply/${inserted.id}`,
    });
    const providerEmailId = result.data?.id;
    if (!providerEmailId) throw new Error("Email provider did not return an identifier");
    let messageId: string | null = null;
    try { messageId = (await retrieveSentEmail(providerEmailId)).message_id || null; } catch { /* email.sent webhook can complete this later */ }
    const { error: messageUpdateError } = await admin.from("enquiry_messages").update({ provider_email_id: providerEmailId, message_id: messageId, delivery_status: "sent" }).eq("id", inserted.id);
    if (messageUpdateError) throw new Error("The sent email could not be recorded");
    const { error: activityError } = await admin.from("enquiry_conversations").update({ last_activity_at: new Date().toISOString() }).eq("enquiry_id", enquiry.id);
    if (activityError) throw new Error("The conversation activity could not be updated");
    if (enquiry.status !== "closed") await admin.from("enquiries").update({ status: "contacted" }).eq("id", enquiry.id);
    await auditThread(admin, parsed.actorId, "enquiry.reply_sent", enquiry.id, inserted.id);
    return { ...inserted, provider_email_id: providerEmailId, delivery_status: "sent" };
  } catch (error) {
    await admin.from("enquiry_messages").update({ delivery_status: "failed" }).eq("id", inserted.id);
    throw new Error(error instanceof Error && error.message.includes("configured") ? error.message : "The email could not be sent. Your reply remains in the composer.");
  }
}

export async function addInternalNote(input: { enquiryId: string; body: string; actorId: string; actorName: string }) {
  const parsed = z.object({ enquiryId: z.string().uuid(), body: z.string().trim().min(1).max(20000), actorId: z.string().uuid(), actorName: z.string().trim().min(1).max(100) }).parse(input);
  const admin = requireServiceClient();
  const { data: enquiry } = await admin.from("enquiries").select("id,type").eq("id", parsed.enquiryId).single();
  if (!enquiry) throw new Error("Enquiry could not be loaded");
  const conversation = await ensureConversation(admin, enquiry.id, enquiry.type);
  const { data, error } = await admin.from("enquiry_messages").insert({ enquiry_id: enquiry.id, direction: "internal", message_type: "internal_note", sender_name: parsed.actorName, subject: conversation.subject, text_body: parsed.body, delivery_status: "note", is_read: true, created_by: parsed.actorId }).select("id").single();
  if (error || !data) throw new Error("Internal note could not be saved");
  await admin.from("enquiry_conversations").update({ last_activity_at: new Date().toISOString() }).eq("enquiry_id", enquiry.id);
  await auditThread(admin, parsed.actorId, "enquiry.note_added", enquiry.id, data.id);
  return data;
}

export async function markEnquiryThreadRead(enquiryId: string) {
  const admin = requireServiceClient();
  const id = z.string().uuid().parse(enquiryId);
  await Promise.all([
    admin.from("enquiry_messages").update({ is_read: true }).eq("enquiry_id", id).eq("direction", "inbound"),
    admin.from("enquiry_conversations").update({ unread_count: 0 }).eq("enquiry_id", id),
  ]);
}

export async function linkUnmatchedInboundEmail(input: { unmatchedId: string; enquiryId: string; actorId: string }) {
  const parsed = z.object({ unmatchedId: z.string().uuid(), enquiryId: z.string().uuid(), actorId: z.string().uuid() }).parse(input);
  const admin = requireServiceClient();
  const [{ data: unmatched }, { data: enquiry }] = await Promise.all([
    admin.from("unmatched_inbound_emails").select("id,provider,provider_email_id,message_id,sender_email,recipient_emails,subject,text_body,in_reply_to,reference_ids,linked_enquiry_id,created_at").eq("id", parsed.unmatchedId).single(),
    admin.from("enquiries").select("id,type").eq("id", parsed.enquiryId).single(),
  ]);
  if (!unmatched || unmatched.linked_enquiry_id) throw new Error("This inbound email is no longer available to link");
  if (!enquiry) throw new Error("The selected enquiry could not be loaded");
  const conversation = await ensureConversation(admin, enquiry.id, enquiry.type);
  const { data: message, error } = await admin.from("enquiry_messages").insert({
    enquiry_id: enquiry.id,
    direction: "inbound",
    message_type: "email",
    sender_name: unmatched.sender_email,
    sender_email: unmatched.sender_email,
    recipient_email: unmatched.recipient_emails?.[0] || null,
    subject: conversation.subject,
    text_body: unmatched.text_body,
    provider: unmatched.provider,
    provider_email_id: unmatched.provider_email_id,
    message_id: unmatched.message_id,
    in_reply_to: unmatched.in_reply_to,
    reference_ids: unmatched.reference_ids || [],
    delivery_status: "received",
    is_read: false,
    created_at: unmatched.created_at,
  }).select("id").single();
  if (error || !message) throw new Error("The inbound email could not be linked");
  const { error: linkError } = await admin.from("unmatched_inbound_emails").update({ linked_enquiry_id: enquiry.id, linked_at: new Date().toISOString() }).eq("id", unmatched.id).is("linked_enquiry_id", null);
  if (linkError) {
    await admin.from("enquiry_messages").delete().eq("id", message.id);
    throw new Error("The inbound email could not be linked safely");
  }
  await admin.rpc("increment_enquiry_unread", { target_enquiry_id: enquiry.id, activity_at: unmatched.created_at });
  await auditThread(admin, parsed.actorId, "enquiry.thread_linked", enquiry.id, message.id, { unmatchedInboundId: unmatched.id });
  return enquiry.id;
}

export async function ignoreUnmatchedInboundEmail(input: { unmatchedId: string; actorId: string }) {
  const parsed = z.object({ unmatchedId: z.string().uuid(), actorId: z.string().uuid() }).parse(input);
  const admin = requireServiceClient();
  const { data, error } = await admin
    .from("unmatched_inbound_emails")
    .update({ ignored_at: new Date().toISOString(), ignored_by: parsed.actorId })
    .eq("id", parsed.unmatchedId)
    .is("linked_enquiry_id", null)
    .is("ignored_at", null)
    .select("id,reason")
    .maybeSingle();
  if (error || !data) throw new Error("This inbound email is no longer available to ignore");
  const { error: auditError } = await admin.from("admin_audit_log").insert({
    actor_id: parsed.actorId,
    action: "enquiry.inbound_ignored",
    entity_type: "unmatched_inbound_email",
    entity_id: parsed.unmatchedId,
    detail: { reason: data.reason },
  });
  if (auditError) throw new Error("The message was ignored, but its required audit entry could not be recorded");
}

export async function beginWebhookEvent(svixId: string, eventType: string, providerEmailId?: string) {
  const admin = requireServiceClient();
  const { error } = await admin.from("resend_webhook_events").insert({ svix_id: svixId, event_type: eventType, provider_email_id: providerEmailId || null });
  if (!error) return { process: true, admin };
  if (error.code !== "23505") throw new Error("Webhook event could not be recorded");
  const { data } = await admin.from("resend_webhook_events").select("processing_status").eq("svix_id", svixId).single();
  if (data?.processing_status === "failed") {
    await admin.from("resend_webhook_events").update({ processing_status: "processing", error_code: null }).eq("svix_id", svixId);
    return { process: true, admin };
  }
  return { process: false, admin };
}

export async function finishWebhookEvent(admin: AdminClient, svixId: string, status: "processed" | "ignored" | "failed", errorCode?: string) {
  await admin.from("resend_webhook_events").update({ processing_status: status, error_code: errorCode || null, processed_at: new Date().toISOString() }).eq("svix_id", svixId);
}

export async function processReceivedEmail(providerEmailId: string) {
  const email = await retrieveReceivedEmail(providerEmailId);
  const headers = email.headers || {};
  const recipients = [...new Set([...(email.received_for || []), ...(email.to || [])].map((value) => value.toLowerCase()))];
  return processNormalizedInboundEmail({
    transport: "resend",
    transportEventId: providerEmailId,
    envelopeFrom: email.from,
    envelopeRecipients: email.received_for || [],
    from: email.from,
    recipients,
    messageId: email.message_id || null,
    inReplyTo: headerValue(headers, "in-reply-to"),
    references: extractMessageIds(headerValue(headers, "references")),
    subject: email.subject || "No subject",
    text: email.text || null,
    html: email.html || null,
    headers,
    createdAt: email.created_at || new Date().toISOString(),
    attachmentCount: 0,
  });
}

export async function processNormalizedInboundEmail(email: NormalizedInboundEmail) {
  const admin = requireServiceClient();
  const replyDomain = getEnquiryReplyDomain();
  if (!replyDomain) throw new Error("Inbound email is not configured");
  let sender: string | null = null;
  try { sender = parseSenderEmail(email.from); } catch { /* malformed senders are retained for admin review, never attached automatically */ }
  const headers = email.headers;
  const inReplyTo = email.inReplyTo;
  const references = email.references;
  const body = safeInboundText(email.text, email.html) || "[No readable plain-text message body]";
  const recipients = [...new Set([...email.envelopeRecipients, ...email.recipients].map((value) => value.toLowerCase()))];
  const automated = sender ? isAutomatedEmail(headers, sender, email.subject) : false;
  const match = await resolveInboundThread({
    recipients,
    inboundDomain: replyDomain,
    inReplyTo,
    references,
    findByToken: async (token) => {
      const { data } = await admin.from("enquiry_conversations").select("enquiry_id").eq("reply_token", token).maybeSingle();
      return data?.enquiry_id || null;
    },
    findByMessageIds: async (messageIds) => {
      const { data } = await admin.from("enquiry_messages").select("enquiry_id").in("message_id", messageIds).limit(1).maybeSingle();
      return data?.enquiry_id || null;
    },
  });
  const enquiryId = match?.enquiryId || null;
  const matchReason = match?.reason || "unmatched";

  if (!sender || automated || !enquiryId) {
    const { error } = await admin.from("unmatched_inbound_emails").upsert({ provider: email.transport, provider_email_id: email.transportEventId, message_id: email.messageId, sender_email: sender || "[invalid sender]", recipient_emails: recipients, subject: email.subject, text_body: body, in_reply_to: inReplyTo, reference_ids: references, reason: !sender ? "invalid_sender" : automated ? "automated_ignored" : "no_confident_thread_match" }, { onConflict: "provider_email_id", ignoreDuplicates: true });
    if (error) throw new Error("Unmatched inbound email could not be retained safely");
    return { matched: false, reason: !sender ? "malformed" : automated ? "automated" : "unmatched" };
  }

  const { data: conversation } = await admin.from("enquiry_conversations").select("subject").eq("enquiry_id", enquiryId).single();
  const { data, error } = await admin.rpc("store_inbound_email_message", {
    target_enquiry_id: enquiryId,
    transport_name: email.transport,
    transport_event_id: email.transportEventId,
    sender_name_value: headerValue(headers, "from") || email.from,
    sender_email_value: sender,
    recipient_email_value: recipients[0] || null,
    subject_value: conversation?.subject || email.subject || "Re: SOB Autofix enquiry",
    text_body_value: body,
    rfc_message_id: email.messageId,
    reply_to_message_id: inReplyTo,
    reference_id_values: references,
    message_created_at: email.createdAt,
    match_reason: matchReason,
  });
  if (error) throw new Error("Inbound message could not be stored");
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.was_inserted) return { matched: true, duplicate: true };
  return { matched: true, enquiryId };
}

export async function beginInboundEmailEvent(eventId: string, rawDigest: string) {
  const admin = requireServiceClient();
  const { data, error } = await admin.rpc("claim_inbound_email_event", {
    transport_name: "cloudflare",
    transport_event_id: eventId,
    mime_digest: rawDigest,
  });
  if (error) throw new Error("Inbound email event could not be recorded");
  return { process: data === true, admin };
}

export async function finishInboundEmailEvent(admin: AdminClient, eventId: string, status: "processed" | "ignored" | "failed", errorCode?: string) {
  const { error } = await admin.rpc("finish_inbound_email_event", {
    transport_name: "cloudflare",
    transport_event_id: eventId,
    final_status: status,
    final_error_code: errorCode || null,
  });
  if (error) throw new Error("Inbound email event status could not be recorded");
}

export async function processDeliveryEvent(data: { email_id: string; message_id?: string }, eventType: string) {
  const admin = requireServiceClient();
  const status = eventType === "email.delivered" ? "delivered" : eventType === "email.bounced" ? "bounced" : eventType === "email.failed" || eventType === "email.suppressed" ? "failed" : "sent";
  await admin.from("enquiry_messages").update({ delivery_status: status, ...(data.message_id ? { message_id: data.message_id } : {}) }).eq("provider_email_id", data.email_id);
}

async function ensureConversation(admin: AdminClient, enquiryId: string, enquiryType: string) {
  const subject = conversationSubject(enquiryType);
  const { data, error } = await admin.from("enquiry_conversations").upsert({ enquiry_id: enquiryId, subject }, { onConflict: "enquiry_id", ignoreDuplicates: true }).select("reply_token,subject").single();
  if (!error && data) return data;
  const { data: existing } = await admin.from("enquiry_conversations").select("reply_token,subject").eq("enquiry_id", enquiryId).single();
  if (!existing) throw new Error("Enquiry conversation could not be loaded");
  return existing;
}

async function auditThread(admin: AdminClient, actorId: string | null, action: string, enquiryId: string, messageId: string, detail: Record<string, unknown> = {}) {
  const { error } = await admin.from("admin_audit_log").insert({ actor_id: actorId, action, entity_type: "enquiry_message", entity_id: messageId, detail: { enquiryId, ...detail } });
  if (error) throw new Error("The message was handled, but its required audit entry could not be recorded");
}

function requireServiceClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Enquiry conversation storage is not configured");
  return admin;
}
