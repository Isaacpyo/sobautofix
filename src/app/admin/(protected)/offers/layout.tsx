import { NoAccess } from "@/components/admin/exchange/ui";
import { requireStaffPage } from "@/lib/exchange/staff";

// Offers is limited by staff role (Staff & access).
export default async function OffersAccessLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = await requireStaffPage("pricing.manage");
  return allowed ? children : <NoAccess area="Offers" />;
}
