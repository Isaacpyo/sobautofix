import { redirect } from "next/navigation";

/** Vehicle Stock moved into Vehicle Buying & Selling. Old links and bookmarks keep working. */
export default async function InventoryRedirect({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", params.page);
  const suffix = query.toString();
  redirect(`/admin/exchange/stock${suffix ? `?${suffix}` : ""}`);
}
