import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1974E2] transition hover:-translate-x-0.5 hover:text-[#1446A5] ${className}`}>
      <ArrowLeft aria-hidden="true" size={17} />
      {children}
    </Link>
  );
}
