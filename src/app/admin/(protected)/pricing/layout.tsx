import { NoAccess } from "@/components/admin/exchange/ui";
import { requireStaffPage } from "@/lib/exchange/staff";

// Pricing is limited by staff role (Staff & access).
export default async function PricingAccessLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = await requireStaffPage("pricing.manage");
  return allowed ? children : <NoAccess area="Pricing" />;
}
