import { NoAccess } from "@/components/admin/exchange/ui";
import { requireStaffPage } from "@/lib/exchange/staff";

// Staff & access is for owners only.
export default async function StaffAccessLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = await requireStaffPage("staff.manage");
  return allowed ? children : <NoAccess area="Staff & access" />;
}
