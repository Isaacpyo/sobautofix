import { AlertTriangle, Lock, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Tone } from "./labels";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[#F2F4F7] text-[#344054] ring-[#E4E7EC]",
  info: "bg-[#EAF2FD] text-[#1446A5] ring-[#C7DCF8]",
  success: "bg-[#ECFDF3] text-[#067647] ring-[#ABEFC6]",
  warning: "bg-[#FFFAEB] text-[#93370D] ring-[#FEDF89]",
  danger: "bg-[#FEF3F2] text-[#B42318] ring-[#FECDCA]",
  muted: "bg-[#F2F4F7] text-[#475467] ring-[#E4E7EC]",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-extrabold ring-1 ring-inset", toneClasses[tone], className)}>{children}</span>;
}

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-extrabold text-[#071127] sm:text-3xl">{title}</h2>
      {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#586575]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>;
}

export function Card({ title, description, actions, children, className, id }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} className={cn("min-w-0 rounded-xl border border-[#E4EAF0] bg-white p-4 sm:p-6", className)}>
    {(title || actions) && <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {title && <h3 id={id ? `${id}-title` : undefined} className="text-lg font-extrabold text-[#071127]">{title}</h3>}
        {description && <p className="mt-1 text-sm leading-6 text-[#586575]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>}
    {children}
  </section>;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="grid place-items-center rounded-xl border border-dashed border-[#C9D5E2] bg-white px-5 py-10 text-center">
    {Icon && <span className="grid size-11 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><Icon size={21} aria-hidden="true" /></span>}
    <h3 className="mt-3 text-base font-extrabold text-[#071127]">{title}</h3>
    {children && <p className="mt-1 max-w-md text-sm leading-6 text-[#586575]">{children}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

export function NoAccess({ area = "this area" }: { area?: string }) {
  return <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-[#E4EAF0] bg-white p-6">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#F2F4F7] text-[#344054]"><Lock size={20} aria-hidden="true" /></span>
    <div>
      <h2 className="text-lg font-extrabold text-[#071127]">You don&apos;t have access to this area</h2>
      <p className="mt-1 text-sm leading-6 text-[#586575]">Your staff role does not include {area}. Ask the owner to change your role in Vehicle Buying &amp; Selling settings if you need it.</p>
    </div>
  </div>;
}

export function Notice({ tone = "warning", title, children }: { tone?: "warning" | "info" | "danger" | "success"; title?: string; children: React.ReactNode }) {
  const styles = { warning: "border-amber-200 bg-amber-50 text-amber-950", info: "border-[#C7DCF8] bg-[#EAF2FD] text-[#1446A5]", danger: "border-red-200 bg-red-50 text-red-900", success: "border-emerald-200 bg-emerald-50 text-emerald-900" }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm leading-6", styles)}>
    <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
    <div>{title && <p className="font-extrabold">{title}</p>}<div>{children}</div></div>
  </div>;
}

export function KeyValues({ items, columns = 2 }: { items: Array<{ label: string; value: React.ReactNode }>; columns?: 1 | 2 | 3 }) {
  return <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
    {items.map((item) => <div key={item.label} className="min-w-0"><dt className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{item.label}</dt><dd className="mt-0.5 break-words text-sm font-semibold text-[#071127]">{item.value}</dd></div>)}
  </dl>;
}

export function StatTile({ label, value, support, href, tone = "default", icon: Icon }: { label: string; value: React.ReactNode; support?: string; href?: string; tone?: "default" | "warning"; icon?: LucideIcon }) {
  const body = <>
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{label}</p>
      {Icon && <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-[#EAF3FF] text-[#1974E2]")}><Icon size={17} aria-hidden="true" /></span>}
    </div>
    <p className="mt-2 text-3xl font-extrabold text-[#071127]">{value}</p>
    {support && <p className="mt-1 text-xs font-semibold text-[#667586]">{support}</p>}
  </>;
  const className = cn("block rounded-xl border bg-white p-4 transition", tone === "warning" ? "border-amber-200" : "border-[#E4EAF0]", href && "hover:-translate-y-0.5 hover:border-[#1974E2]/45 hover:shadow-[0_10px_24px_rgba(7,17,39,0.08)] focus-visible:outline-3 focus-visible:outline-[#1974E2]/50");
  return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

export const buttonStyles = {
  primary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-extrabold text-white transition hover:bg-[#1462C4] disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#C9D5E2] bg-white px-4 text-sm font-extrabold text-[#071127] transition hover:border-[#1974E2] hover:text-[#1462C4] disabled:cursor-not-allowed disabled:opacity-50",
  dark: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071127] px-4 text-sm font-extrabold text-white transition hover:bg-[#1B2740] disabled:cursor-not-allowed disabled:opacity-50",
  danger: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-extrabold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50",
  dangerSolid: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B42318] px-4 text-sm font-extrabold text-white transition hover:bg-[#912018] disabled:cursor-not-allowed disabled:opacity-50",
  link: "inline-flex min-h-11 items-center gap-1.5 text-sm font-extrabold text-[#1462C4] underline-offset-4 hover:underline",
} as const;

export function LinkButton({ href, children, variant = "secondary", className }: { href: string; children: React.ReactNode; variant?: keyof typeof buttonStyles; className?: string }) {
  return <Link href={href} className={cn(buttonStyles[variant], className)}>{children}</Link>;
}

export function Thumb({ url, alt, className }: { url?: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnails come from Supabase storage and are already sized.
  return url ? <img src={url} alt={alt} loading="lazy" className={cn("aspect-[4/3] w-24 shrink-0 rounded-lg bg-[#E4EAF0] object-cover", className)} /> : <span aria-hidden="true" className={cn("grid aspect-[4/3] w-24 shrink-0 place-items-center rounded-lg bg-[#F2F4F7] text-[0.65rem] font-bold text-[#667586]", className)}>No photo</span>;
}
