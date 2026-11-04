import { NoAccess } from "@/components/admin/exchange/ui";
import { requireStaffPage } from "@/lib/exchange/staff";

// website settings is limited by staff role (Staff & access).
export default async function SiteSettingsAccessLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = await requireStaffPage("site.manage");
  return allowed ? children : <NoAccess area="website settings" />;
}
