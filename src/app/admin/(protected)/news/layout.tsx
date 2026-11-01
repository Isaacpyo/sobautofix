import { NoAccess } from "@/components/admin/exchange/ui";
import { requireStaffPage } from "@/lib/exchange/staff";

// News & Blog is limited by staff role (Staff & access).
export default async function NewsAccessLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = await requireStaffPage("content.manage");
  return allowed ? children : <NoAccess area="News & Blog" />;
}
