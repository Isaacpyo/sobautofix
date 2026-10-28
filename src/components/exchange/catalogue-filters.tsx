"use client";

import { ArrowDownUp, LoaderCircle, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  activeFilterCount,
  catalogueQueryString,
  filterKeys,
  parseCatalogueFilters,
  sortOptions,
  type CatalogueFilterOptions,
  type CatalogueFilters,
  type FilterKey,
} from "@/lib/exchange/public/catalogue";
import { cn } from "@/lib/utils";
import { buttonClass, inputClass, labelClass } from "./ui";

const fieldLabels: Record<FilterKey, string> = {
  make: "Make",
  model: "Model",
  minPrice: "Price from",
  maxPrice: "Price up to",
  maxMileage: "Mileage",
  minYear: "Year",
  fuel: "Fuel type",
  transmission: "Gearbox",
  condition: "Condition",
};

const fieldOrder: FilterKey[] = ["make", "model", "minPrice", "maxPrice", "maxMileage", "minYear", "fuel", "transmission", "condition"];

function useCatalogueNavigation(path: string, filters: CatalogueFilters) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(next: Partial<CatalogueFilters>) {
    const merged = { ...filters, ...next };
    // A model only belongs to its make.
    if ("make" in next && next.make !== filters.make) merged.model = undefined;
    startTransition(() => router.push(`${path}${catalogueQueryString(merged)}`, { scroll: false }));
  }
  return { navigate, pending };
}

type PanelProps = { path: string; filters: CatalogueFilters; options: CatalogueFilterOptions; resultCount: number; idPrefix: string; onDone?: () => void };

export function CatalogueFilterPanel({ path, filters, options, resultCount, idPrefix, onDone }: PanelProps) {
  const { navigate, pending } = useCatalogueNavigation(path, filters);
  const formRef = useRef<HTMLFormElement>(null);

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const key = event.target.name as FilterKey;
    if (!filterKeys.includes(key)) return;
    const parsed = parseCatalogueFilters(new URLSearchParams({ [key]: event.target.value }));
    navigate({ [key]: parsed[key] });
  }

  return (
    <form ref={formRef} action={path} method="get" onSubmit={(event) => { event.preventDefault(); onDone?.(); }} aria-label="Filter cars" className="grid gap-4">
      {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
      {fieldOrder.map((key) => {
        const choices = options[key];
        const selected = filters[key] === undefined ? "" : String(filters[key]);
        if (!choices.length && !selected) return null;
        const id = `${idPrefix}-${key}`;
        return (
          <div key={key}>
            <label htmlFor={id} className={labelClass}>{fieldLabels[key]}</label>
            <select id={id} name={key} value={selected} onChange={onChange} className={cn(inputClass, "mt-1.5 appearance-auto pr-3")}>
              <option value="">Any</option>
              {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label} ({choice.count})</option>)}
              {selected && !choices.some((choice) => choice.value === selected) && <option value={selected}>{selected} (0)</option>}
            </select>
          </div>
        );
      })}
      <div className="grid gap-2 pt-1">
        <button type="submit" className={buttonClass("primary", "w-full")} aria-live="polite">
          {pending ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Updating</> : `Show ${resultCount} ${resultCount === 1 ? "car" : "cars"}`}
        </button>
        {activeFilterCount(filters) > 0 && (
          <Link href={`${path}${catalogueQueryString({ sort: filters.sort })}`} scroll={false} onClick={onDone} className={buttonClass("ghost", "w-full")}>Clear all filters</Link>
        )}
      </div>
    </form>
  );
}

export function CatalogueToolbar(props: Omit<PanelProps, "idPrefix" | "onDone">) {
  const { path, filters } = props;
  const { navigate, pending } = useCatalogueNavigation(path, filters);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const sortId = useId();
  const count = activeFilterCount(filters);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <div className="flex items-end justify-between gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "min-h-12 lg:hidden")}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={18} aria-hidden="true" /> Filters
        {count > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-[#1974E2] px-1.5 text-xs leading-6 font-bold text-white"><span className="sr-only">, </span>{count}<span className="sr-only"> active</span></span>}
      </button>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <label htmlFor={sortId} className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-[#344054]"><ArrowDownUp size={16} aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Sort by</span></label>
        <select
          id={sortId}
          value={filters.sort}
          onChange={(event) => navigate({ sort: parseCatalogueFilters(new URLSearchParams({ sort: event.target.value })).sort })}
          className={cn(inputClass, "min-h-12 w-auto max-w-[13rem] min-w-0 py-2 pr-3 pl-3 text-[15px]")}
        >
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {pending && <LoaderCircle size={18} className="animate-spin text-[#1462C4]" aria-label="Updating results" />}
      </div>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === dialogRef.current) setOpen(false); }}
        aria-labelledby={`${sortId}-title`}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-[#344054] shadow-2xl backdrop:bg-[#0B1220]/60 sm:m-auto sm:max-w-md sm:rounded-3xl lg:hidden"
      >
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between border-b border-[#E3E8EF] px-5 py-3">
            <h2 id={`${sortId}-title`} className="text-[24px] font-bold text-[#0B1220]">Filters{count > 0 ? ` (${count})` : ""}</h2>
            <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-xl text-[#0B1220] hover:bg-[#F3F5F8]" aria-label="Close filters"><X size={22} aria-hidden="true" /></button>
          </div>
          <div className="overflow-y-auto px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
            {open && <CatalogueFilterPanel {...props} idPrefix="drawer" onDone={() => setOpen(false)} />}
          </div>
        </div>
      </dialog>
    </div>
  );
}

const CATALOGUE_KEY = "sob-exchange-catalogue";
const RESTORE_KEY = "sob-exchange-catalogue-restore";

/**
 * Remember the exact catalogue URL and scroll position, so "Back to results"
 * on a vehicle page returns to the same filtered list at the same place.
 * Filters live in the query string, so the URL is also shareable.
 */
export function RememberCatalogueUrl() {
  useEffect(() => {
    const url = `${window.location.pathname}${window.location.search}`;
    const save = () => {
      try {
        sessionStorage.setItem(CATALOGUE_KEY, JSON.stringify({ url, y: Math.round(window.scrollY) }));
      } catch {
        // Storage unavailable: the back link falls back to the unfiltered catalogue.
      }
    };
    // Returning from a vehicle page: restore where they were.
    try {
      const restore = sessionStorage.getItem(RESTORE_KEY);
      sessionStorage.removeItem(RESTORE_KEY);
      const saved = JSON.parse(sessionStorage.getItem(CATALOGUE_KEY) || "null") as { url?: string; y?: number } | null;
      if (restore === url && saved?.url === url && typeof saved.y === "number") {
        const y = saved.y;
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }));
      }
    } catch {
      // Ignore unreadable storage.
    }
    save();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
    };
  });
  return null;
}

/** The remembered catalogue URL, and a function that asks the catalogue to restore its scroll position. */
export function readRememberedCatalogue(fallback: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CATALOGUE_KEY) || "null") as { url?: string } | null;
    if (saved?.url && saved.url.startsWith(fallback) && !saved.url.startsWith("//")) return saved.url;
  } catch {
    // Ignore unreadable storage.
  }
  return fallback;
}

export function requestCatalogueRestore(url: string) {
  try {
    sessionStorage.setItem(RESTORE_KEY, url);
  } catch {
    // Ignore unavailable storage.
  }
}
