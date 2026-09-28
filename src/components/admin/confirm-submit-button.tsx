"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";

export function ConfirmSubmitButton({ children, message, className }: { children: React.ReactNode; message: string; className: string }) {
  const [open, setOpen] = useState(false);
  const { pending } = useFormStatus();

  return <>
    <button type="button" className={className} aria-hidden={open || undefined} tabIndex={open ? -1 : undefined} onClick={() => setOpen(true)}>{children}</button>
    <ConfirmActionDialog open={open} pending={pending} message={message} confirmLabel={children} confirmType="submit" onCancel={() => setOpen(false)} />
  </>;
}
