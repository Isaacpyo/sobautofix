"use client";

import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { regenerateMfaRecoveryCodes } from "./actions";

export function RecoveryCodeDisplay({ codes, title = "Save your recovery codes" }: { codes: string[]; title?: string }) {
  return <section className="rounded-2xl border-2 border-[#1974E2] bg-[#F7FBFF] p-6 sm:p-7" aria-labelledby="recovery-code-display-heading">
    <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><CheckCircle2 size={21} /></span><div><h2 id="recovery-code-display-heading" className="text-xl font-bold text-[#071127]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#344256]"><strong>These codes are shown only once.</strong> Store them in a password manager or another secure offline location. Each code can replace a lost authenticator one time.</p></div></div>
    <ol className="mt-6 grid gap-2 rounded-xl bg-[#071127] p-5 font-mono text-sm font-bold tracking-wide text-white sm:grid-cols-2">
      {codes.map((code, index) => <li key={code}><span className="mr-2 text-[#67B9FF]">{String(index + 1).padStart(2, "0")}.</span>{code}</li>)}
    </ol>
    <p className="mt-4 text-xs leading-5 text-[#586575]">Leaving or refreshing this page permanently removes these plaintext values from the application. Existing values cannot be retrieved later.</p>
  </section>;
}

export function RecoveryCodesPanel({ remaining, total }: { remaining: number; total: number }) {
  const [state, action, pending] = useActionState(regenerateMfaRecoveryCodes, { message: "" });
  if (state.recoveryCodes) return <RecoveryCodeDisplay codes={state.recoveryCodes} title="Replacement recovery codes" />;
  const hasSet = total > 0;
  return <section className="mt-10 rounded-2xl border border-[#E4EAF0] bg-white p-6 sm:p-7" aria-labelledby="recovery-codes-heading">
    <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><KeyRound size={21} /></span><div><h2 id="recovery-codes-heading" className="text-xl font-bold text-[#071127]">MFA recovery codes</h2><p className="mt-2 text-sm leading-6 text-[#586575]">Use one code only if you lose access to your authenticator. Email access by itself cannot replace MFA.</p></div></div>
    <div className="mt-6 rounded-xl bg-[#F4F7FA] p-4"><p className="font-bold text-[#071127]">{hasSet ? `${remaining} of ${total} recovery codes remaining` : "No recovery-code set is available"}</p><p className="mt-1 text-xs leading-5 text-[#667586]">The application stores hashes only and cannot show existing code values.</p></div>
    {state.message && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-900">{state.message}</p>}
    <form action={action} className="mt-5"><Button type="submit" variant="outline" disabled={pending}>{pending ? <><LoaderCircle size={18} className="animate-spin" />Creating codes…</> : hasSet ? "Replace recovery codes" : "Create recovery codes"}</Button></form>
    {hasSet && <p className="mt-3 text-xs leading-5 text-[#8A4B00]">Replacing the set immediately revokes every unused old code and all trusted-device grants.</p>}
  </section>;
}
