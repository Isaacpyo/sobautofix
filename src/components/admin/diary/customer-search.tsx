"use client";

import { ChevronRight, LoaderCircle, Mail, Phone, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CustomerSummary } from "@/lib/customers/repository";
import { cn } from "@/lib/utils";

type SearchAction = (query: string) => Promise<{ ok: boolean; customers: CustomerSummary[]; message?: string }>;

const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

export function CustomerRow({ customer }: { customer: CustomerSummary }) {
  return (
    <Link href={`/admin/customers/${customer.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#E3E8EF] bg-white px-4 py-3 hover:border-[#1974E2] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EAF2FD] text-sm font-extrabold text-[#0B3B7A]" aria-hidden="true">{customer.anonymised ? "-" : initials(customer.name)}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-bold", customer.anonymised ? "text-[#5B6575]" : "text-[#0B1220]")}>{customer.name}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-[#5B6575]">
          {customer.phone && <span className="inline-flex items-center gap-1"><Phone size={13} aria-hidden="true" /><span className="sr-only">Phone </span>{customer.phone}</span>}
          {customer.email && <span className="inline-flex min-w-0 items-center gap-1 truncate"><Mail size={13} aria-hidden="true" /><span className="sr-only">Email </span>{customer.email}</span>}
          {!customer.phone && !customer.email && <span>No contact details</span>}
        </span>
      </span>
      <span className="hidden shrink-0 text-xs text-[#5B6575] sm:block">Added {dateFormat.format(new Date(customer.createdAt))}</span>
      <ChevronRight size={18} className="shrink-0 text-[#1974E2]" aria-hidden="true" />
    </Link>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

/** Searches as you type through a server action; the recent list shows until there is a query. */
export function CustomerSearch({ recent, search }: { recent: CustomerSummary[]; search: SearchAction }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSummary[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const id = ++latest.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await search(trimmed);
          if (id !== latest.current) return;
          setResults(result.customers);
          setMessage(result.ok ? null : result.message || "Search failed.");
        } catch {
          if (id === latest.current) setMessage("Search failed. Try again.");
        }
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [trimmed, search]);

  const showing = trimmed.length >= 2 ? results ?? [] : recent;
  const status = trimmed.length < 2 ? `${recent.length} most recent customers` : pending ? "Searching" : message ?? `${showing.length} ${showing.length === 1 ? "customer" : "customers"} found`;

  return (
    <div className="grid grid-cols-1 gap-4">
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
        <label htmlFor="customer-search" className="mb-1 block text-sm font-bold text-[#0B1220]">Search customers</label>
        <Search size={18} className="pointer-events-none absolute bottom-3.5 left-3.5 text-[#5B6575]" aria-hidden="true" />
        <input id="customer-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value.trim().length < 2) { setResults(null); setMessage(null); } }} autoComplete="off" placeholder="Name, email or phone" aria-describedby="customer-search-status" className="h-12 w-full rounded-xl border border-[#D0D5DD] bg-white pr-10 pl-11 text-base text-[#0B1220] focus:border-[#1974E2] focus:outline-3 focus:outline-[rgba(22,139,255,.35)]" />
        {pending && <LoaderCircle size={18} className="absolute right-3.5 bottom-3.5 animate-spin text-[#5B6575]" aria-hidden="true" />}
      </form>
      <p id="customer-search-status" className="text-sm font-semibold text-[#344054]" aria-live="polite">{status}</p>
      {showing.length ? (
        <ul className="grid grid-cols-1 gap-2">
          {showing.map((customer) => <li key={customer.id}><CustomerRow customer={customer} /></li>)}
        </ul>
      ) : trimmed.length >= 2 && !pending ? (
        <p className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white px-4 py-5 text-sm text-[#5B6575]">No customers match. Anonymised customers are not searchable.</p>
      ) : null}
    </div>
  );
}
