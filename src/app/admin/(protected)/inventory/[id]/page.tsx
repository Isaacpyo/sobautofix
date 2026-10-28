import { notFound, redirect } from "next/navigation";

export default async function InventoryVehicleRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  redirect(`/admin/exchange/stock/${id}`);
}
