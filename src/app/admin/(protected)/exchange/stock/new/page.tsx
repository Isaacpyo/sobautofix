import { AddVehicleFlow } from "@/components/admin/add-vehicle-flow";
import { NoAccess, PageHeading } from "@/components/admin/exchange/ui";
import { BackLink } from "@/components/ui/back-link";
import { requireStaffPage } from "@/lib/exchange/staff";
import { createStockDraftAction } from "../actions";

export default async function NewStockVehiclePage() {
  const { staff, allowed } = await requireStaffPage("stock.edit");
  if (!allowed) return <NoAccess area="adding stock" />;
  return <>
    <BackLink href="/admin/exchange/stock">Back to Vehicle Stock</BackLink>
    <div className="mb-6 mt-3"><PageHeading eyebrow="Vehicle Stock" title="Add a vehicle" description="Look the vehicle up by registration. It is saved as a Draft; nothing is shown to customers until it is published." /></div>
    <AddVehicleFlow action={createStockDraftAction} editorBasePath="/admin/exchange/stock" draftOnly canSetPrice={staff.can("stock.price")} />
  </>;
}
