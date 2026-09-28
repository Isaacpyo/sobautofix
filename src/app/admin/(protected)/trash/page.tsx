import { Trash2 } from "lucide-react";
import { AdminBulkActions, AdminItemCheckbox } from "@/components/admin/admin-bulk-actions";
import { createAdminReadClient } from "@/lib/supabase/server";
import { manageTrashAction } from "./actions";

type TrashItem = { id: string; title: string; detail: string; deletedAt: string };
type TrashSection = { entity: string; label: string; note?: string; items: TrashItem[] };

export default async function AdminTrashPage() {
  const client = await createAdminReadClient();
  const results = client ? await Promise.all([
    client.from("enquiries").select("id,type,deleted_at,customers(name,email)").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    client.from("bookings").select("id,booking_reference,service_name,deleted_at,customers(name)").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    client.from("invoices").select("id,invoice_number,status,customer_name,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    client.from("sale_vehicles").select("id,year,make,model,registration,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    client.from("content_entries").select("id,title,slug,status,deleted_at").eq("kind", "article").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    client.from("media_assets").select("id,alt_text,object_path,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    client.from("reviews").select("id,author_name,rating,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    client.from("offers").select("id,title,active,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
  ]) : Array.from({ length: 8 }, () => ({ data: [] }));

  const sections: TrashSection[] = [
    { entity: "enquiries", label: "Enquiries", items: (results[0].data || []).map((item) => ({ id: item.id, title: relation(item.customers)?.name || "Customer enquiry", detail: String(item.type).replaceAll("_", " "), deletedAt: item.deleted_at! })) },
    { entity: "bookings", label: "Bookings", items: (results[1].data || []).map((item) => ({ id: item.id, title: item.booking_reference, detail: `${relation(item.customers)?.name || "Customer"} · ${item.service_name}`, deletedAt: item.deleted_at! })) },
    { entity: "invoices", label: "Invoices", note: "Only draft invoices can be permanently deleted. Issued, paid and linked financial records remain protected.", items: (results[2].data || []).map((item) => ({ id: item.id, title: item.invoice_number || "Draft invoice", detail: `${item.customer_name} · ${item.status}`, deletedAt: item.deleted_at! })) },
    { entity: "inventory", label: "Vehicle stock", items: (results[3].data || []).map((item) => ({ id: item.id, title: `${item.year} ${item.make} ${item.model}`, detail: item.registration || "No registration", deletedAt: item.deleted_at! })) },
    { entity: "news", label: "News & Blog", items: (results[4].data || []).map((item) => ({ id: item.id, title: item.title, detail: `/news/${item.slug} · ${item.status}`, deletedAt: item.deleted_at! })) },
    { entity: "media", label: "Media", items: (results[5].data || []).map((item) => ({ id: item.id, title: item.alt_text, detail: item.object_path, deletedAt: item.deleted_at! })) },
    { entity: "reviews", label: "Reviews", items: (results[6].data || []).map((item) => ({ id: item.id, title: item.author_name, detail: `${item.rating}/5 review`, deletedAt: item.deleted_at! })) },
    { entity: "offers", label: "Offers", items: (results[7].data || []).map((item) => ({ id: item.id, title: item.title, detail: item.active ? "Previously active" : "Inactive", deletedAt: item.deleted_at! })) },
  ];
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  return <>
    <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-700"><Trash2 size={23} /></span><div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Recovery area</p><h1 className="mt-1 text-4xl font-extrabold text-[#071127]">Trash</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#667586]">Restore records to their original CMS list or permanently remove eligible records. Items remain recoverable until permanent deletion.</p></div></div>
    <p className="mt-6 text-sm font-bold text-[#586575]">{total} trashed {total === 1 ? "item" : "items"}</p>
    <div className="mt-2 grid gap-8">
      {sections.map((section) => <section key={section.entity} aria-labelledby={`trash-${section.entity}`}>
        <div className="flex items-end justify-between gap-4"><div><h2 id={`trash-${section.entity}`} className="text-2xl font-extrabold text-[#071127]">{section.label}</h2>{section.note && <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-800">{section.note}</p>}</div><span className="text-sm font-bold text-[#667586]">{section.items.length}</span></div>
        <AdminBulkActions entity={section.entity} mode="trash" action={manageTrashAction}>
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white">
            {section.items.map((item) => <div key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#E4EAF0] px-3 py-3 first:border-t-0"><AdminItemCheckbox id={item.id} label={`Select ${item.title}`} /><div className="min-w-0"><p className="truncate font-extrabold text-[#071127]">{item.title}</p><p className="mt-1 truncate text-xs capitalize text-[#667586]">{item.detail}</p></div><time dateTime={item.deletedAt} className="text-xs font-semibold text-[#667586]">{formatDate(item.deletedAt)}</time></div>)}
            {!section.items.length && <p className="px-5 py-7 text-sm text-[#667586]">No {section.label.toLowerCase()} in trash.</p>}
          </div>
        </AdminBulkActions>
      </section>)}
    </div>
  </>;
}

function relation<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] || null : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
