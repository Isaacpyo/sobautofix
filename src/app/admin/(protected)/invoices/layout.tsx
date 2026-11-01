import { NoAccess } from "@/components/admin/exchange/ui";
import { requireStaffPage } from "@/lib/exchange/staff";

// Invoices is limited by staff role (Staff & access).
export default async function InvoicesAccessLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = await requireStaffPage("finance.view");
  return allowed ? children : <NoAccess area="Invoices" />;
}
