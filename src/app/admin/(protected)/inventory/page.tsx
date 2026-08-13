import { Plus } from "lucide-react";
import Link from "next/link";
import { AdminListFilters, AdminPagination } from "@/components/admin/admin-list-controls";
import { createAdminReadClient as createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

type InventoryRow = { id: string; registration: string | null; slug: string; make: string; model: string; year: number; price: number; status: string; updated_at: string };
const pageSize = 20;

export default async function InventoryAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const status = params.status || "";
  const requestedPage = positivePage(params.page);
  const client = await createClient();
  const { data } = client ? await client.from("sale_vehicles").select("id, registration, slug, make, model, year, price, status, updated_at").order("updated_at", { ascending: false }).limit(500) : { data: [] };
  const filtered = ((data || []) as InventoryRow[]).filter((vehicle) => {
    const searchable = [vehicle.make, vehicle.model, vehicle.registration, vehicle.slug, vehicle.year].filter(Boolean).join(" ").toLowerCase();
    return (!query || searchable.includes(query.toLowerCase())) && (!status || vehicle.status === status);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const vehicles = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Vehicle sales</p><h1 className="mt-2 text-4xl font-extrabold text-[#071127]">Vehicle stock</h1><p className="mt-2 text-sm text-[#667586]">Search and filter the vehicles currently managed in inventory.</p></div><Link href="/admin/inventory/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1974E2] px-4 font-bold text-white"><Plus size={17} />Add vehicle</Link></div>
    <AdminListFilters action="/admin/inventory" query={query} status={status} placeholder="Registration, make, model or year…" statusOptions={[{ value: "draft", label: "Draft" }, { value: "available", label: "Live" }, { value: "reserved", label: "Reserved" }, { value: "sold", label: "Sold" }]} />
    <div className="mt-5 max-h-[60vh] overflow-auto rounded-2xl border border-[#E4EAF0] bg-white">
      <table className="w-full min-w-[650px] text-left text-sm"><thead className="sticky top-0 z-10 bg-[#F4F7FA] text-xs uppercase text-[#667586] shadow-[0_1px_0_#E4EAF0]"><tr><th className="p-4">Vehicle</th><th className="p-4">Price</th><th className="p-4">Status</th><th className="p-4">Updated</th></tr></thead><tbody>{vehicles.map((vehicle) => <tr key={vehicle.id} className="border-t border-[#E4EAF0] hover:bg-[#F8FAFC]"><td className="p-4"><Link className="font-bold text-[#071127] hover:text-[#1974E2]" href={`/admin/inventory/${vehicle.id}`}>{vehicle.year} {vehicle.make} {vehicle.model}</Link><span className="block text-xs text-[#667586]">{vehicle.registration || `/${vehicle.slug}`}</span></td><td className="p-4 font-bold">{formatCurrency(vehicle.price)}</td><td className="p-4 capitalize">{vehicle.status === "available" ? "Live" : vehicle.status}</td><td className="p-4 text-[#667586]">{new Date(vehicle.updated_at).toLocaleDateString("en-GB")}</td></tr>)}</tbody></table>
      {!vehicles.length && <p className="p-8 text-center text-[#667586]">No vehicles match the current filters.</p>}
    </div>
    <AdminPagination path="/admin/inventory" page={page} pageSize={pageSize} totalItems={filtered.length} query={query} status={status} />
  </>;
}

function positivePage(value?: string) { const parsed = Number.parseInt(value || "1", 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : 1; }
