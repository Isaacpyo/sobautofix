// SOB Auto Exchange design primitives (tokens from docs/exchange/ARCHITECTURE.md).
// ink #0B1220, text #344054, muted #5B6575, surface #FFFFFF / #F3F5F8,
// line #E3E8EF, charcoal #111827, accent #1974E2 (hover #1462C4, links #1462C4),
// accent-soft #EAF2FD. Radius 16px cards, 12px inputs/buttons, pills for chips.

import { AlertTriangle, Wrench } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { availability, writeOffBadge, type AvailabilityTone } from "@/lib/exchange/public/format";
import type { SaleVehicle } from "@/types/domain";

export const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";

export const buttonStyles = {
  base: cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60", focusRing),
  primary: "bg-[#1974E2] text-white hover:bg-[#1462C4]",
  secondary: "border border-[#C9D3E0] bg-white text-[#0B1220] hover:border-[#1974E2] hover:text-[#1462C4]",
  ghost: "text-[#1462C4] hover:bg-[#EAF2FD]",
  dark: "bg-[#0B1220] text-white hover:bg-[#1F2937]",
  inverse: "bg-white text-[#0B1220] hover:bg-[#EAF2FD]",
};

export type ButtonVariant = keyof Omit<typeof buttonStyles, "base">;

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(buttonStyles.base, buttonStyles[variant], className);
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}

export const inputClass = cn(
  "block min-h-12 w-full rounded-xl border border-[#C9D3E0] bg-white px-4 py-3 text-base text-[#0B1220] placeholder:text-[#8A94A6]",
  "aria-[invalid=true]:border-[#B42318] focus:border-[#1974E2] focus:outline-3 focus:outline-offset-0 focus:outline-[rgba(22,139,255,.35)]",
);

export const labelClass = "block text-sm font-semibold text-[#0B1220]";
export const hintClass = "mt-1 block text-sm text-[#5B6575]";
export const errorClass = "mt-1.5 block text-sm font-medium text-[#B42318]";
export const linkClass = cn("font-semibold text-[#1462C4] underline decoration-[#1462C4]/30 underline-offset-4 hover:decoration-[#1462C4]", focusRing);

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] font-semibold tracking-[.08em] text-[#1462C4] uppercase", className)}>{children}</p>;
}

export function SectionHeading({ eyebrow, title, intro, action, className, id }: { eyebrow?: string; title: string; intro?: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={id} className="mt-1 text-[32px] leading-[1.05] font-bold text-[#0B1220] sm:text-[40px]">{title}</h2>
        {intro && <p className="mt-3 text-base leading-7 text-[#5B6575]">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

const toneClasses: Record<AvailabilityTone, string> = {
  available: "bg-[#ECFDF3] text-[#067647] ring-[#ABEFC6]",
  reserved: "bg-[#FFFAEB] text-[#93370D] ring-[#FEDF89]",
  sold: "bg-[#FEF3F2] text-[#B42318] ring-[#FECDCA]",
  withdrawn: "bg-[#F2F4F7] text-[#344054] ring-[#D0D5DD]",
};

export function AvailabilityChip({ status, className }: { status: SaleVehicle["status"]; className?: string }) {
  const { label, tone } = availability(status);
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset", toneClasses[tone], className)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/** Repair-project and recorded write-off disclosures. Always text, never colour alone. */
export function DisclosureBadges({ vehicle, className }: { vehicle: Pick<SaleVehicle, "listingCondition" | "writeOffStatus">; className?: string }) {
  const writeOff = writeOffBadge(vehicle.writeOffStatus);
  if (vehicle.listingCondition !== "repair_project" && !writeOff) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {vehicle.listingCondition === "repair_project" && (
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[#0B1220] px-3 text-[13px] font-semibold text-white">
          <Wrench size={14} aria-hidden="true" /> Repair project
        </span>
      )}
      {writeOff && (
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[#FFFAEB] px-3 text-[13px] font-semibold text-[#93370D] ring-1 ring-[#FEDF89] ring-inset">
          <AlertTriangle size={14} aria-hidden="true" /> {writeOff}
        </span>
      )}
    </span>
  );
}

export function Notice({ tone = "info", title, children, className, role }: { tone?: "info" | "warning" | "success" | "error"; title?: string; children: ReactNode; className?: string; role?: "status" | "alert" }) {
  const tones = {
    info: "border-[#B9D4F6] bg-[#EAF2FD] text-[#0B1220]",
    warning: "border-[#FEDF89] bg-[#FFFAEB] text-[#93370D]",
    success: "border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]",
    error: "border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]",
  };
  return (
    <div role={role} className={cn("rounded-2xl border px-4 py-3.5 text-[15px] leading-6", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

export function Price({ value, className }: { value: number; className?: string }) {
  return <span className={cn("exchange-display font-bold tracking-tight text-[#0B1220] tabular-nums", className)}>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value)}</span>;
}
