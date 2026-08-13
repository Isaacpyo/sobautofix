import { notFound } from "next/navigation";
import { InvoiceForm, type InvoiceFormInitial } from "@/components/admin/invoice-form";
import { BackLink } from "@/components/ui/back-link";
import { getInvoiceForAdmin } from "@/lib/invoices/repository";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoiceForAdmin(id);
  if (!invoice || invoice.status !== "draft") notFound();
  const initial: InvoiceFormInitial = {
    id: invoice.id, sourceType: invoice.source_type, bookingId: invoice.booking_id || undefined, enquiryId: invoice.enquiry_id || undefined,
    customerId: invoice.customer_id || undefined, vehicleId: invoice.vehicle_id || undefined, customerName: invoice.customer_name,
    customerEmail: invoice.customer_email || "", customerPhone: invoice.customer_phone || "", customerAddress: invoice.customer_address || "",
    vehicleRegistration: invoice.vehicle_registration || "", vehicleMake: invoice.vehicle_make || "", vehicleModel: invoice.vehicle_model || "",
    serviceName: invoice.service_name || "", appointmentStart: invoice.appointment_start || "", issueDate: invoice.issue_date || "", dueDate: invoice.due_date || "",
    discount: penceInput(invoice.discount_pence), notes: invoice.notes || "", paymentTerms: invoice.payment_terms || "",
    items: invoice.invoice_items.map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: penceInput(item.unit_price_pence) })),
  };
  return <><BackLink href={`/admin/invoices/${id}`}>Back to draft</BackLink><header className="mt-5"><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Draft invoice</p><h1 className="mt-1 text-4xl font-extrabold text-[#071127]">Edit invoice</h1><p className="mt-2 text-[#667586]">Financial and snapshot details remain editable until this draft is issued.</p></header><InvoiceForm initial={initial} /></>;
}

function penceInput(value: number | string) { const pence = BigInt(value); return `${pence / 100n}.${String(pence % 100n).padStart(2, "0")}`; }
