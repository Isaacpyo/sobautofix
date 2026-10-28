import Link from "next/link";

type Option = { value: string; label: string };
type SelectFilter = { name: string; label: string; value: string; options: ReadonlyArray<Option>; allLabel?: string };

/** GET filter bar for exchange lists: search plus any number of selects. */
export function ExchangeListFilters({ action, query, placeholder, selects }: { action: string; query: string; placeholder: string; selects: SelectFilter[] }) {
  const active = Boolean(query) || selects.some((select) => select.value);
  return <form action={action} method="get" role="search" className="mt-4 grid gap-3 rounded-xl border border-[#E4EAF0] bg-white p-4 sm:grid-cols-2 lg:flex lg:items-end">
    <label className="min-w-0 text-xs font-extrabold tracking-wide text-[#667586] uppercase sm:col-span-2 lg:flex-1">Search
      <input name="q" type="search" defaultValue={query} placeholder={placeholder} className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#D7E0E9] px-3.5 text-sm font-medium text-[#071127] normal-case outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15" />
    </label>
    {selects.map((select) => <label key={select.name} className="text-xs font-extrabold tracking-wide text-[#667586] uppercase lg:w-48">{select.label}
      <select name={select.name} defaultValue={select.value} className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#D7E0E9] bg-white px-3 text-sm font-bold text-[#071127] normal-case outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15">
        {select.allLabel !== undefined && <option value="">{select.allLabel}</option>}
        {select.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>)}
    <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
      <button className="min-h-11 flex-1 rounded-xl bg-[#1974E2] px-5 text-sm font-extrabold text-white transition hover:bg-[#1462C4] lg:flex-none">Apply</button>
      {active && <Link href={action} className="grid min-h-11 place-items-center rounded-xl border border-[#D7E0E9] px-4 text-sm font-bold text-[#586575] hover:bg-[#F4F7FA]">Clear</Link>}
    </div>
  </form>;
}

/** Quick filter chips (status tabs) with counts. */
export function FilterChips({ action, param, value, options, keep = {} }: { action: string; param: string; value: string; options: Array<Option & { count?: number }>; keep?: Record<string, string> }) {
  return <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Quick filters">
    {options.map((option) => {
      const params = new URLSearchParams(Object.entries(keep).filter(([, v]) => Boolean(v)));
      if (option.value) params.set(param, option.value);
      const href = params.toString() ? `${action}?${params}` : action;
      const selected = option.value === value;
      return <Link role="listitem" key={option.value || "all"} href={href} aria-current={selected ? "true" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition ${selected ? "border-[#1974E2] bg-[#EAF2FD] text-[#1462C4]" : "border-[#D7E0E9] bg-white text-[#344054] hover:border-[#1974E2]"}`}>
        {option.label}{option.count !== undefined && <span className={`rounded-full px-1.5 text-xs ${selected ? "bg-white" : "bg-[#F2F4F7]"}`}>{option.count}</span>}
      </Link>;
    })}
  </div>;
}
