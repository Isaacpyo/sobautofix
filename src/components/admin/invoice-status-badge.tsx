import { cn } from "@/lib/utils";
import { invoiceStatusLabel, type InvoiceStatus } from "@/lib/invoices/types";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1.5 text-xs font-extrabold", status === "draft" && "bg-[#E4EAF0] text-[#586575]", status === "issued" && "bg-amber-100 text-amber-900", status === "paid" && "bg-green-100 text-green-800", status === "void" && "bg-red-50 text-red-800")}>{invoiceStatusLabel(status)}</span>;
}
