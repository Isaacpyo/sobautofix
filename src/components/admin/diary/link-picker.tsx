"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { LinkKind, LinkOption } from "@/lib/diary/repository";
import { cn } from "@/lib/utils";

type SearchAction = (kind: LinkKind, query: string) => Promise<{ ok: boolean; options: LinkOption[]; message?: string }>;

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";

/**
 * Picks one linked record (vehicle, customer, enquiry, submission or sale).
 * The selected id goes in a hidden input; searching calls a server action so
 * names and registrations never appear in a URL.
 */
export function LinkPicker({ kind, name, label, hint, value, onChange, search, disabled, disabledReason }: {
  kind: LinkKind;
  name: string;
  label: string;
  hint?: string;
  value: LinkOption | null;
  onChange: (option: LinkOption | null) => void;
  search: SearchAction;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const current = ++requestId.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await search(kind, query);
          if (current !== requestId.current) return;
          setOptions(result.options);
          setMessage(result.ok ? (result.options.length ? null : "No matches.") : result.message || "Search failed.");
        } catch {
          if (current === requestId.current) setMessage("Search failed. Try again.");
        }
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query, kind, search]);

  function openSearch() {
    setOpen(true);
    setMessage(null);
    window.setTimeout(() => input.current?.focus(), 0);
  }

  function close(focusChange = true) {
    setOpen(false);
    setQuery("");
    if (focusChange) window.setTimeout(() => changeButton.current?.focus(), 0);
  }

  return (
    <fieldset className="min-w-0" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-1 text-sm font-bold text-[#0B1220]">{label}</legend>
      {hint && <p id={`${id}-hint`} className="mb-1.5 text-xs text-[#5B6575]">{hint}</p>}
      <input type="hidden" name={name} value={value?.id ?? ""} />
      {disabled ? (
        <p className="rounded-xl border border-[#E3E8EF] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#344054]">{value ? value.label : "None"}{disabledReason && <span className="mt-0.5 block text-xs text-[#5B6575]">{disabledReason}</span>}</p>
      ) : !open ? (
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-1.5">
          <span className="min-w-0 flex-1 text-sm">
            {value ? <><span className="block truncate font-semibold text-[#0B1220]">{value.label}</span>{value.detail && <span className="block truncate text-xs text-[#5B6575]">{value.detail}</span>}</> : <span className="text-[#5B6575]">None linked</span>}
          </span>
          <button ref={changeButton} type="button" onClick={openSearch} className={cn("min-h-10 rounded-lg px-2 text-sm font-bold text-[#1462C4] hover:bg-[#EAF2FD]", focusRing)}>
            {value ? "Change" : "Link"}<span className="sr-only"> {label.toLowerCase()}</span>
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className={cn("min-h-10 rounded-lg px-2 text-sm font-bold text-[#B42318] hover:bg-[#FEF3F2]", focusRing)}>
              Remove<span className="sr-only"> {label.toLowerCase()}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[#1974E2] bg-white p-2 shadow-[0_0_0_3px_rgba(25,116,226,.12)]">
          <div className="relative">
            <label htmlFor={`${id}-search`} className="sr-only">Search {label.toLowerCase()}</label>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5B6575]" aria-hidden="true" />
            <input
              ref={input}
              id={`${id}-search`}
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") { event.preventDefault(); close(); }
                if (event.key === "Enter") event.preventDefault();
                if (event.key === "ArrowDown") { event.preventDefault(); (event.currentTarget.closest("div.rounded-xl")?.querySelector<HTMLButtonElement>("[data-option]"))?.focus(); }
              }}
              placeholder="Type to search"
              aria-controls={`${id}-results`}
              className="h-11 w-full rounded-lg border border-[#D0D5DD] pr-10 pl-9 text-sm text-[#0B1220] focus:border-[#1974E2] focus:outline-none"
            />
            {pending && <LoaderCircle size={16} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-[#5B6575]" aria-hidden="true" />}
          </div>
          <p className="sr-only" aria-live="polite">{pending ? "Searching" : message ?? `${options.length} results`}</p>
          <ul id={`${id}-results`} className="mt-2 grid max-h-64 gap-1 overflow-y-auto" aria-label={`${label} results`}>
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  data-option
                  onClick={() => { onChange(option); close(); }}
                  onKeyDown={(event) => {
                    const items = Array.from(event.currentTarget.closest("ul")?.querySelectorAll<HTMLButtonElement>("[data-option]") ?? []);
                    const index = items.indexOf(event.currentTarget);
                    if (event.key === "ArrowDown") { event.preventDefault(); items[Math.min(items.length - 1, index + 1)]?.focus(); }
                    if (event.key === "ArrowUp") { event.preventDefault(); if (index <= 0) input.current?.focus(); else items[index - 1]?.focus(); }
                    if (event.key === "Escape") { event.preventDefault(); close(); }
                  }}
                  className={cn("w-full rounded-lg px-3 py-2 text-left hover:bg-[#EAF2FD]", focusRing, value?.id === option.id && "bg-[#EAF2FD]")}
                >
                  <span className="block text-sm font-semibold text-[#0B1220]">{option.label}</span>
                  {option.detail && <span className="block text-xs text-[#5B6575]">{option.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
          {message && !pending && <p className="px-2 py-1 text-sm text-[#5B6575]">{message}</p>}
          <div className="mt-1 flex justify-end">
            <button type="button" onClick={() => close()} className={cn("inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-bold text-[#344054] hover:bg-[#F3F5F8]", focusRing)}><X size={16} aria-hidden="true" /> Close search</button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
