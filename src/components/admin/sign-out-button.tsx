"use client";

import { LogOut } from "lucide-react";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/admin/login/actions";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { cn } from "@/lib/utils";

/**
 * Sidebar and drawer sign-out, confirmed first so a stray tap does not end the
 * session. The dialog is portalled to <body>: the mobile drawer is transformed,
 * which would otherwise trap a fixed overlay inside it.
 */
export function SignOutButton({ compact = false, className, onBeforeConfirm }: { compact?: boolean; className?: string; onBeforeConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return <>
    <button
      type="button"
      onClick={() => { onBeforeConfirm?.(); setOpen(true); }}
      aria-label={compact ? "Sign out" : undefined}
      aria-haspopup="dialog"
      title={compact ? "Sign out" : undefined}
      className={className}
    >
      <LogOut size={17} aria-hidden="true" /> {!compact && "Sign out"}
    </button>
    {open && createPortal(
      <ConfirmActionDialog
        open
        pending={pending}
        tone="info"
        icon={LogOut}
        title="Sign out?"
        message="You will need your password to sign back in, plus your authenticator code if two-step verification is on. Anything not yet saved will be lost."
        confirmLabel="Sign out"
        onCancel={() => setOpen(false)}
        onConfirm={() => startTransition(async () => { await signOut(); })}
      />,
      document.body,
    )}
  </>;
}

export const signOutButtonStyles = (compact: boolean) => cn(
  "mt-2 flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-[#C6D2DF] hover:bg-white/[0.06] hover:text-white",
  compact && "justify-center px-2",
);
