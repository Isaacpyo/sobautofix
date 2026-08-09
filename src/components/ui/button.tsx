import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const styles = {
  primary: "bg-[#1974E2] text-white shadow-[0_12px_32px_rgba(25,116,226,.28)] hover:bg-[#168BFF]",
  secondary: "border border-[#67B9FF]/45 bg-transparent text-white hover:border-[#1974E2] hover:bg-[#1974E2]/10",
  outline: "border border-[#1974E2]/25 bg-white text-[#071127] hover:border-[#1974E2]/60 hover:bg-[#F4F7FA]",
  ghost: "bg-transparent text-current hover:bg-[#1974E2]/10",
};

type Shared = { children: ReactNode; variant?: keyof typeof styles; className?: string };

export function Button({ children, variant = "primary", className, ...props }: Shared & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition", styles[variant], className)} {...props}>{children}</button>;
}

export function ButtonLink({ children, variant = "primary", className, href, ...props }: Shared & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <Link className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition", styles[variant], className)} href={href} {...props}>{children}</Link>;
}
