"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A footer link column. On phones the heading is a button that opens and
 * closes the list; from md up the list is always shown and the heading is
 * plain text.
 */
export function FooterSection({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <nav aria-label={label} className="border-b border-white/10 md:border-0">
      <h2 className="text-sm font-semibold tracking-[.08em] text-white uppercase">
        <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between rounded text-left uppercase md:hidden">
          {title}
          <ChevronDown size={18} aria-hidden="true" className={cn("text-[#AEB6C2] transition motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        <span className="hidden md:inline">{title}</span>
      </h2>
      <ul id={listId} className={cn("gap-1 pb-4 md:mt-3 md:grid md:pb-0", open ? "grid" : "hidden")}>{children}</ul>
    </nav>
  );
}
