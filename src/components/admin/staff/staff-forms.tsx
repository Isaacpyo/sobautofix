"use client";

import { Check, Copy, Pencil, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { ActionForm, ConfirmButton, SelectField, SubmitButton, TextField, useFormContext } from "@/components/admin/exchange/forms";
import { buttonStyles } from "@/components/admin/exchange/ui";
import { inviteStaffAction, removeAccessAction, resendInviteAction, restoreAccessAction, updateStaffAction } from "@/app/admin/(protected)/staff/actions";
import { staffRoleLabels, staffRoles, type StaffRole } from "@/lib/exchange/permissions";
import { cn } from "@/lib/utils";

const roleHints: Record<StaffRole, string> = {
  owner: "Owner: everything, including staff and settings",
  manager: "Manager: everything except staff and settings",
  sales: "Sales: enquiries, stock, viewings and customers; no money or prices",
  workshop: "Workshop: preparation, inspections and the diary",
};
const roleOptions = staffRoles.map((role) => ({ value: role, label: roleHints[role] }));

/** Shows a one-time set-up link when an invite email could not be sent. */
function InviteLinkNotice({ className }: { className?: string }) {
  const { state } = useFormContext();
  const [copied, setCopied] = useState(false);
  if (state.status !== "success" || !state.link) return null;
  const link = state.link;
  return <div role="status" className={cn("mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950", className)}>
    <p className="font-bold">Send this link to them privately</p>
    <p className="mt-1 leading-6">It lets them choose a password, works once and expires soon. Anyone with it can set the password, so don&apos;t post it anywhere public.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <input readOnly value={link} aria-label="Set-up link" onFocus={(event) => event.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 font-mono text-xs text-[#071127]" />
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => undefined); setCopied(true); }} className={cn(buttonStyles.secondary, "min-h-11")}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  </div>;
}

export function InviteStaffForm() {
  return <ActionForm action={inviteStaffAction} resetOnSuccess className="grid gap-4" aria-label="Invite a staff member">
    <div className="grid gap-4 md:grid-cols-2">
      <TextField name="name" label="Name" autoComplete="off" required />
      <TextField name="email" label="Email" type="email" autoComplete="off" inputMode="email" required />
    </div>
    <SelectField name="role" label="Role" defaultValue="sales" options={roleOptions} required />
    <div className="flex justify-end"><SubmitButton pendingLabel="Sending invite…"><UserPlus size={16} aria-hidden="true" /> Send invite</SubmitButton></div>
    <InviteLinkNotice />
  </ActionForm>;
}

type MemberProps = { userId: string; name: string; role: StaffRole; isYou: boolean; status: "active" | "invited" | "removed" };

/** The buttons on a staff row, with the edit panel opening full width underneath. */
export function MemberActions({ userId, name, role, isYou, status }: MemberProps) {
  const [editing, setEditing] = useState(false);
  return <>
    <div className="flex flex-wrap items-center gap-2">
      {status !== "removed" && <button type="button" onClick={() => setEditing((open) => !open)} aria-expanded={editing} className={cn(buttonStyles.secondary, "min-h-11")} aria-label={`Edit ${name}`}><Pencil size={15} aria-hidden="true" /> Edit</button>}
      {status === "invited" && <ResendInviteForm userId={userId} name={name} />}
      {!isYou && <AccessToggleForm userId={userId} name={name} removed={status === "removed"} />}
    </div>
    {editing && <EditStaffForm userId={userId} name={name} role={role} isYou={isYou} onClose={() => setEditing(false)} />}
  </>;
}

function EditStaffForm({ userId, name, role, isYou, onClose }: { userId: string; name: string; role: StaffRole; isYou: boolean; onClose: () => void }) {
  return <ActionForm action={updateStaffAction} hidden={{ userId }} onSuccess={onClose} className="grid w-full basis-full gap-3 rounded-xl border border-[#E4EAF0] bg-[#F8FAFC] p-4" aria-label={`Edit ${name}`}>
    <div className="grid gap-3 md:grid-cols-2">
      <TextField name="name" label="Name" defaultValue={name} required />
      {isYou
        ? <div><p className="text-sm font-bold text-[#071127]">Role</p><p className="mt-2 text-sm text-[#586575]">{staffRoleLabels[role]}. You can&apos;t change your own role.</p><input type="hidden" name="role" value={role} /></div>
        : <SelectField name="role" label="Role" defaultValue={role} options={roleOptions} required />}
    </div>
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onClose} className={cn(buttonStyles.link, "min-h-11 px-2")}>Cancel</button>
      <SubmitButton>Save changes</SubmitButton>
    </div>
  </ActionForm>;
}

function ResendInviteForm({ userId, name }: { userId: string; name: string }) {
  return <ActionForm action={resendInviteAction} hidden={{ userId }} className="contents" aria-label={`Resend invite to ${name}`}>
    <SubmitButton variant="secondary" pendingLabel="Sending…" className="min-h-11"><Send size={15} aria-hidden="true" /> Resend invite</SubmitButton>
    <InviteLinkNotice className="mt-2 basis-full" />
  </ActionForm>;
}

function AccessToggleForm({ userId, name, removed }: { userId: string; name: string; removed: boolean }) {
  return removed
    ? <ActionForm action={restoreAccessAction} hidden={{ userId }} className="contents" aria-label={`Restore access for ${name}`}>
        <ConfirmButton variant="secondary" tone="warning" title={`Restore access for ${name}?`} message="They will be able to sign in again with their existing password and the role shown." confirmLabel="Restore access" className="min-h-11">Restore access</ConfirmButton>
      </ActionForm>
    : <ActionForm action={removeAccessAction} hidden={{ userId }} className="contents" aria-label={`Remove access for ${name}`}>
        <ConfirmButton title={`Remove ${name}'s access?`} message="They are signed out and can no longer sign in. Their past work and history stay. You can restore access later." confirmLabel="Remove access" className="min-h-11">Remove access</ConfirmButton>
      </ActionForm>;
}
