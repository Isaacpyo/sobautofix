import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone, ReceiptText, UserRound } from "lucide-react";
import { AdminLoadingLink } from "@/components/admin/admin-loading-link";
import { EnquiryReplyComposer } from "@/components/admin/enquiry-reply-composer";
import { MarkEnquiryRead } from "@/components/admin/mark-enquiry-read";
import { BackLink } from "@/components/ui/back-link";
import { getCloudflareInboundConfig } from "@/lib/enquiries/inbound-config";
import { createAdminReadClient } from "@/lib/supabase/server";
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
  const client = await createAdminReadClient();
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
  const messages = (hasWebsiteMessage || !enquiry.description
    ? storedMessages
    : ([{ id: `legacy-${enquiry.id}`, direction: "inbound", message_type: "website_enquiry", sender_name: enquiry.customers?.name || "Customer", text_body: enquiry.description, delivery_status: "received", created_at: enquiry.created_at }, ...storedMessages] as MessageRow[]))
    .toSorted(compareConversationMessages);
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
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
        <div className="min-w-0">
      <div className="lg:sticky lg:top-0 lg:z-20 lg:bg-[#F4F7FA]">
      <header className="rounded-2xl border border-[#E4EAF0] bg-white p-5 shadow-sm sm:p-7">
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
            : <AdminLoadingLink href={`/admin/invoices/new?source=enquiry&enquiryId=${enquiry.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold text-[#071127] hover:border-[#1974E2]" loadingTitle="Preparing invoice" loadingDescription="Please wait while the enquiry details are added to a new invoice."><ReceiptText size={16} />Create invoice</AdminLoadingLink>}
        </div>
      </header>
      </div>

      {!getCloudflareInboundConfig() && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">Inbound email sync is not configured. Website enquiries remain available, but customer email replies will not appear here until configuration is completed.</p>}

      <section aria-labelledby="thread-heading" className="mt-4 rounded-2xl border border-[#D6E3F0] bg-[#EAF2FA] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="thread-heading" className="text-xl font-extrabold text-[#071127]">Conversation</h2>
          <span className="text-sm text-[#667586]">{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
        </div>
        <div className="mt-2.5 grid gap-2">
          {messages.map((message) => <ThreadMessage key={message.id} message={message} />)}
          {!messages.length && <p className="rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">No conversation messages are available.</p>}
        </div>
        {enquiry.enquiry_attachments.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#E4EAF0] bg-white p-3">
            <p className="text-xs font-extrabold tracking-widest text-[#667586] uppercase">Original private attachments · links expire in 5 minutes</p>
            <div className="mt-3 flex flex-wrap gap-2">{enquiry.enquiry_attachments.map((attachment) => {
              const url = signedByPath.get(attachment.object_path);
              return url ? <a key={attachment.id} href={url} className="rounded-lg bg-[#EAF3FF] px-3 py-2 text-sm font-bold text-[#1974E2]">{attachment.file_name}</a> : null;
            })}</div>
          </div>
        )}
      </section>

        </div>
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-label="Write a message">
          <EnquiryReplyComposer enquiryId={enquiry.id} customerEmail={customer?.email || null} initialClientRequestId={randomUUID()} replyAction={sendEnquiryReplyAction} noteAction={saveInternalNoteAction} />
        </aside>
      </div>
    </>
  );
}

function ThreadMessage({ message }: { message: MessageRow }) {
  const internal = message.direction === "internal";
  const outbound = message.direction === "outbound";
  const heading = message.message_type === "website_enquiry" ? "Customer enquiry" : message.message_type === "automatic_confirmation" ? "SOB Autofix · Automatic confirmation" : internal ? "Internal note" : outbound ? "SOB Autofix" : "Customer";
  return (
    <article className={`rounded-xl border p-3 ${internal ? "border-amber-300 bg-amber-50" : outbound ? "border-[#8EBEF5] bg-[#EAF3FF]" : "border-emerald-200 bg-white"}`}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full text-[0.6rem] font-black shadow-sm ${internal ? "bg-amber-200 text-amber-950" : outbound ? "bg-[#1446A5] text-white" : "bg-emerald-100 text-emerald-800"}`}>
          {internal ? "IN" : outbound ? "SOB" : <UserRound size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className={`text-sm leading-5 font-extrabold ${internal ? "text-amber-950" : outbound ? "text-[#1446A5]" : "text-emerald-900"}`}>{heading}</h3>{outbound && message.sender_name && <p className="text-[0.7rem] leading-4 text-[#667586]">Sent by {message.sender_name}</p>}</div>
            <time className="text-[0.7rem] leading-4 text-[#667586]" dateTime={message.created_at}>{formatDate(message.created_at)}</time>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5 text-[#263446]">{message.text_body}</p>
          {(outbound || message.delivery_status === "failed") && <p className={`mt-1.5 text-[0.65rem] font-bold uppercase tracking-wide ${message.delivery_status === "failed" || message.delivery_status === "bounced" ? "text-red-700" : "text-[#586575]"}`}>{deliveryLabel(message.delivery_status)}</p>}
        </div>
      </div>
    </article>
  );
}

function ActionLink({ href, icon, label, external = false }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold text-[#071127] hover:border-[#1974E2]">{icon}{label}</a>;
}

function formatType(value: string) { return value.replaceAll("_", " "); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
function deliveryLabel(value: string) { return value === "sending" ? "Sending" : value === "sent" ? "Sent" : value === "delivered" ? "Delivered" : value === "bounced" ? "Bounced" : value === "failed" ? "Failed to send" : value; }
function compareConversationMessages(left: MessageRow, right: MessageRow) {
  return right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id);
}
