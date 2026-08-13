import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone, ReceiptText } from "lucide-react";
import { EnquiryReplyComposer } from "@/components/admin/enquiry-reply-composer";
import { MarkEnquiryRead } from "@/components/admin/mark-enquiry-read";
import { BackLink } from "@/components/ui/back-link";
import { getCloudflareInboundConfig } from "@/lib/enquiries/inbound-config";
import { createAdminReadClient as createClient } from "@/lib/supabase/server";
import { markEnquiryThreadReadAction, saveInternalNoteAction, sendEnquiryReplyAction, updateEnquiryStatus } from "../../actions";

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  message_type: "website_enquiry" | "email" | "internal_note" | "automatic_confirmation";
  sender_name: string | null;
  text_body: string;
  delivery_status: string;
  created_at: string;
};

type EnquiryRow = {
  id: string;
  type: string;
  service_slug: string | null;
  description: string | null;
  location_postcode: string | null;
  status: string;
  notification_status: string;
  created_at: string;
  customers: { name: string; email: string | null; phone: string } | null;
  vehicles: { registration: string | null; make: string | null; model: string | null; colour: string | null; year: number | null } | null;
  enquiry_attachments: Array<{ id: string; object_path: string; file_name: string }>;
};

export default async function EnquiryConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  if (!client) notFound();
  const [{ data: enquiryData, error: enquiryError }, { data: messagesData, error: messagesError }, { data: linkedInvoiceData }] = await Promise.all([
    client.from("enquiries").select("id,type,service_slug,description,location_postcode,status,notification_status,created_at,customers(name,email,phone),vehicles(registration,make,model,colour,year),enquiry_attachments(id,object_path,file_name)").eq("id", id).maybeSingle(),
    client.from("enquiry_messages").select("id,direction,message_type,sender_name,text_body,delivery_status,created_at").eq("enquiry_id", id).order("created_at", { ascending: true }).order("id", { ascending: true }),
    client.from("invoices").select("id,invoice_number,status").eq("enquiry_id", id).neq("status", "void").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (enquiryError) throw new Error("Could not load the enquiry");
  if (messagesError) throw new Error("Could not load the enquiry conversation");
  if (!enquiryData) notFound();
  const enquiry = enquiryData as unknown as EnquiryRow;
  const storedMessages = (messagesData || []) as MessageRow[];
  const hasWebsiteMessage = storedMessages.some((message) => message.message_type === "website_enquiry");
  const messages: MessageRow[] = hasWebsiteMessage || !enquiry.description
    ? storedMessages
    : ([{ id: `legacy-${enquiry.id}`, direction: "inbound", message_type: "website_enquiry", sender_name: enquiry.customers?.name || "Customer", text_body: enquiry.description, delivery_status: "received", created_at: enquiry.created_at }, ...storedMessages] as MessageRow[])
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
  const paths = enquiry.enquiry_attachments.map((item) => item.object_path);
  const { data: signed } = paths.length ? await client.storage.from("enquiry-attachments").createSignedUrls(paths, 300) : { data: [] };
  const signedByPath = new Map((signed || []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  const customer = enquiry.customers;
  const vehicleSummary = enquiry.vehicles ? [enquiry.vehicles.make, enquiry.vehicles.model].filter(Boolean).join(" ") : "";
  const whatsappNumber = customer?.phone.replace(/[^+\d]/g, "") || "";
  const linkedInvoice = linkedInvoiceData as { id: string; invoice_number: string | null; status: string } | null;

  return (
    <>
      <MarkEnquiryRead enquiryId={enquiry.id} action={markEnquiryThreadReadAction} />
      <BackLink href="/admin/enquiries">Back to enquiries</BackLink>
      <header className="mt-5 rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">{formatType(enquiry.type)} enquiry</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#071127]">{customer?.name || "Customer enquiry"}</h1>
            {vehicleSummary && <p className="mt-3 font-bold text-[#071127]">{vehicleSummary}</p>}
            {enquiry.vehicles?.registration && <p className="mt-1 text-sm font-extrabold tracking-wider text-[#586575] uppercase">{enquiry.vehicles.registration}</p>}
            {enquiry.location_postcode && <p className="mt-2 text-sm text-[#586575]">Location: {enquiry.location_postcode}</p>}
          </div>
          <form action={updateEnquiryStatus} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={enquiry.id} />
            <label htmlFor="enquiry-status" className="sr-only">Enquiry status</label>
            <select id="enquiry-status" name="status" defaultValue={enquiry.status} className="min-h-11 rounded-xl border border-[#D7E0E9] bg-white px-3 text-sm font-bold">
              <option value="new">New</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="closed">Closed</option>
            </select>
            <button className="min-h-11 rounded-xl bg-[#071127] px-4 text-sm font-bold text-white">Update</button>
          </form>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {customer?.phone && <ActionLink href={`tel:${customer.phone}`} icon={<Phone size={16} />} label="Call" />}
          {customer?.email && <ActionLink href={`mailto:${customer.email}`} icon={<Mail size={16} />} label="Email" />}
          {whatsappNumber && <ActionLink href={`https://wa.me/${whatsappNumber.replace(/^\+/, "")}`} icon={<MessageCircle size={16} />} label="WhatsApp" external />}
          {linkedInvoice
            ? <ActionLink href={`/admin/invoices/${linkedInvoice.id}`} icon={<ReceiptText size={16} />} label={`Invoice ${linkedInvoice.invoice_number || "Draft"}`} />
            : <ActionLink href={`/admin/invoices/new?source=enquiry&enquiryId=${enquiry.id}`} icon={<ReceiptText size={16} />} label="Create invoice" />}
        </div>
      </header>

      {!getCloudflareInboundConfig() && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">Inbound email sync is not configured. Website enquiries remain available, but customer email replies will not appear here until configuration is completed.</p>}

      <section aria-labelledby="thread-heading" className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 id="thread-heading" className="text-2xl font-extrabold text-[#071127]">Conversation</h2>
          <span className="text-sm text-[#667586]">{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
        </div>
        <div className="mt-4 grid gap-4">
          {messages.map((message) => <ThreadMessage key={message.id} message={message} />)}
          {!messages.length && <p className="rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">No conversation messages are available.</p>}
        </div>
        {enquiry.enquiry_attachments.length > 0 && (
          <div className="mt-5 rounded-xl border border-[#E4EAF0] bg-white p-4">
            <p className="text-xs font-extrabold tracking-widest text-[#667586] uppercase">Original private attachments · links expire in 5 minutes</p>
            <div className="mt-3 flex flex-wrap gap-2">{enquiry.enquiry_attachments.map((attachment) => {
              const url = signedByPath.get(attachment.object_path);
              return url ? <a key={attachment.id} href={url} className="rounded-lg bg-[#EAF3FF] px-3 py-2 text-sm font-bold text-[#1974E2]">{attachment.file_name}</a> : null;
            })}</div>
          </div>
        )}
      </section>

      <EnquiryReplyComposer enquiryId={enquiry.id} customerEmail={customer?.email || null} initialClientRequestId={randomUUID()} replyAction={sendEnquiryReplyAction} noteAction={saveInternalNoteAction} />
    </>
  );
}

function ThreadMessage({ message }: { message: MessageRow }) {
  const internal = message.direction === "internal";
  const outbound = message.direction === "outbound";
  const heading = message.message_type === "website_enquiry" ? "Customer enquiry" : message.message_type === "automatic_confirmation" ? "SOB Autofix · Automatic confirmation" : internal ? "Internal note" : outbound ? "SOB Autofix" : "Customer";
  return (
    <article className={`rounded-2xl border p-5 sm:p-6 ${internal ? "border-amber-200 bg-amber-50" : outbound ? "border-[#BFD8F7] bg-[#F4F8FE]" : "border-[#E4EAF0] bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-extrabold text-[#071127]">{heading}</h3>{outbound && message.sender_name && <p className="mt-1 text-xs text-[#667586]">Sent by {message.sender_name}</p>}</div>
        <time className="text-xs text-[#667586]" dateTime={message.created_at}>{formatDate(message.created_at)}</time>
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-[#263446]">{message.text_body}</p>
      {(outbound || message.delivery_status === "failed") && <p className={`mt-4 text-xs font-bold uppercase tracking-wide ${message.delivery_status === "failed" || message.delivery_status === "bounced" ? "text-red-700" : "text-[#667586]"}`}>{deliveryLabel(message.delivery_status)}</p>}
    </article>
  );
}

function ActionLink({ href, icon, label, external = false }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold text-[#071127] hover:border-[#1974E2]">{icon}{label}</a>;
}

function formatType(value: string) { return value.replaceAll("_", " "); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
function deliveryLabel(value: string) { return value === "sending" ? "Sending" : value === "sent" ? "Sent" : value === "delivered" ? "Delivered" : value === "bounced" ? "Bounced" : value === "failed" ? "Failed to send" : value; }
