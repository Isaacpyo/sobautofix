"use client";

import { CalendarPlus, CarFront, HandCoins, KeyRound, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { can, type ExchangePermission, type StaffRole } from "@/lib/exchange/permissions";

export type QuickAction = { href: string; label: string; description: string; icon: LucideIcon; permission: ExchangePermission };

export const quickActions: QuickAction[] = [
  { href: "/admin/diary/new", label: "New appointment", description: "Viewing, inspection, collection or handover", icon: CalendarPlus, permission: "diary.manage" },
  { href: "/admin/exchange/stock/new", label: "New vehicle listing", description: "Add a car to stock", icon: CarFront, permission: "stock.edit" },
  { href: "/admin/exchange/enquiries/new?type=buying", label: "New buying enquiry", description: "A customer wants to sell us a car", icon: HandCoins, permission: "buying.manage" },
  { href: "/admin/exchange/enquiries/new?type=sales", label: "New sales enquiry", description: "A customer is interested in our stock", icon: KeyRound, permission: "sales.manage" },
];

export function quickActionsFor(role: StaffRole) {
  return quickActions.filter((action) => can(role, action.permission));
}

/**
 * The sheet opened by the raised New button. A modal dialog: focus moves to
 * the first action, Tab stays inside, Escape or the backdrop closes it and
 * focus returns to the button that opened it (handled by the caller).
 */
export function MobileQuickActions({ role, open, onClose }: { role: StaffRole; open: boolean; onClose: () => void }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const actions = quickActionsFor(role);

  useEffect(() => {
    if (!open) return;
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusable()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-[#030712]/60" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-4 pt-3 pb-[calc(20px_+_env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(3,7,18,.25)]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[#D0D5DD]" aria-hidden="true" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-extrabold text-[#0B1220]">Create new</h2>
          <button type="button" onClick={onClose} aria-label="Close create menu" className="grid size-11 place-items-center rounded-full text-[#344054] hover:bg-[#F3F5F8] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]">
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {actions.length ? (
          <ul className="mt-2 grid gap-2">
            {actions.map(({ href, label, description, icon: Icon }) => (
              <li key={href}>
                <Link href={href} onClick={onClose} className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#E3E8EF] px-3 py-2.5 text-left hover:border-[#1974E2] hover:bg-[#F5F9FF] focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2FD] text-[#1462C4]"><Icon size={20} aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-[#0B1220]">{label}</span>
                    <span className="block text-sm text-[#5B6575]">{description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl bg-[#F3F5F8] p-4 text-sm text-[#344054]">Your role cannot create records from here.</p>
        )}
      </div>
    </div>
  );
}
