"use client";

import { LoaderCircle, Mail } from "lucide-react";
import { useFormStatus } from "react-dom";

export function BookingEmailThreadButton({
  label,
  showLabel = false,
}: {
  label: string;
  showLabel?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={pending ? "Opening email thread" : label}
      title={label}
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#BCD6F6] px-3 text-xs font-extrabold text-[#1446A5] transition hover:border-[#1974E2] hover:bg-[#F1F7FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/20 disabled:cursor-wait disabled:opacity-70"
    >
      {pending
        ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
        : <Mail size={16} aria-hidden="true" />}
      {showLabel && <span>{pending ? "Opening email…" : "Email customer"}</span>}
    </button>
  );
}
