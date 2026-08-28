import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type FilterOption = { value: string; label: string };

export function AdminListFilters({ action, query, status, statusOptions, placeholder = "Search records…", additionalParams = {} }: { action: string; query: string; status: string; statusOptions: FilterOption[]; placeholder?: string; additionalParams?: Record<string, string> }) {
  return (
    <form action={action} method="get" className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#E4EAF0] bg-white p-4 sm:flex-row sm:items-end">
      {Object.entries(additionalParams).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <label className="min-w-0 flex-1 text-xs font-extrabold tracking-wide text-[#667586] uppercase">Search
        <input name="q" defaultValue={query} placeholder={placeholder} className="mt-2 block min-h-11 w-full rounded-xl border border-[#D7E0E9] px-4 text-sm font-medium text-[#071127] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/10" />
      </label>
      <label className="text-xs font-extrabold tracking-wide text-[#667586] uppercase sm:w-52">Status
        <select name="status" defaultValue={status} className="mt-2 block min-h-11 w-full rounded-xl border border-[#D7E0E9] bg-white px-4 text-sm font-bold text-[#071127] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/10">
          <option value="">All statuses</option>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button className="min-h-11 rounded-xl bg-[#1974E2] px-5 text-sm font-extrabold text-white transition hover:bg-[#155FBD]">Apply filters</button>
      {(query || status || Object.values(additionalParams).some(Boolean)) && <Link href={action} className="grid min-h-11 place-items-center rounded-xl border border-[#D7E0E9] px-4 text-sm font-bold text-[#586575] hover:bg-[#F4F7FA]">Clear</Link>}
    </form>
  );
}

export function AdminPagination({ path, page, pageSize, totalItems, query, status, additionalParams = {} }: { path: string; page: number; pageSize: number; totalItems: number; query: string; status: string; additionalParams?: Record<string, string> }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (!totalItems) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <nav aria-label="List pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4EAF0] bg-white px-4 py-3">
      <p className="text-sm font-semibold text-[#667586]">Showing {start}–{end} of {totalItems}</p>
      <div className="flex items-center gap-2">
        <PageLink disabled={page <= 1} href={pageHref(path, page - 1, query, status, additionalParams)}><ChevronLeft aria-hidden="true" size={16} /> Previous</PageLink>
        <span className="px-2 text-sm font-extrabold text-[#071127]">Page {page} of {totalPages}</span>
        <PageLink disabled={page >= totalPages} href={pageHref(path, page + 1, query, status, additionalParams)}>Next <ChevronRight aria-hidden="true" size={16} /></PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  return disabled
    ? <span aria-disabled="true" className="inline-flex items-center gap-1 rounded-lg border border-[#E4EAF0] px-3 py-2 text-sm font-bold text-[#A3AFBC]">{children}</span>
    : <Link href={href} data-admin-pagination-link className="inline-flex items-center gap-1 rounded-lg border border-[#C9D5E2] px-3 py-2 text-sm font-bold text-[#1446A5] hover:border-[#1974E2] hover:bg-[#F1F7FF]">{children}</Link>;
}

function pageHref(path: string, page: number, query: string, status: string, additionalParams: Record<string, string>) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  Object.entries(additionalParams).forEach(([name, value]) => {
    if (value) params.set(name, value);
  });
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}
