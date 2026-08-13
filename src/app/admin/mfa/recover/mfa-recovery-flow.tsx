"use client";

import { KeyRound, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  startAuthenticatorReplacement,
  verifyAuthenticatorReplacement,
  verifyMfaRecoveryCode,
} from "./actions";

function QrImage({ src }: { src: string }) {
  // Supabase supplies a transient SVG data URI that must not be optimized or persisted.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={208} height={208} alt="QR code for replacement SOB Autofix admin authenticator" />;
}

export function RecoveryCodeForm() {
  const [state, action, pending] = useActionState(verifyMfaRecoveryCode, { message: "" });
  return <form action={action} className="mt-7 grid gap-5">
    <label className="text-sm font-bold text-[#071127]" htmlFor="mfa-recovery-code">Single-use recovery code
      <input id="mfa-recovery-code" name="recoveryCode" autoComplete="one-time-code" required autoFocus className="mt-2 block min-h-14 w-full rounded-xl border border-[#C9D5E2] px-4 text-center font-mono text-lg font-black tracking-wider uppercase outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" />
    </label>
    {state.message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{state.message}</p>}
    <Button type="submit" disabled={pending}>{pending ? <><LoaderCircle size={18} className="animate-spin" />Verifying…</> : <><KeyRound size={18} />Verify recovery code</>}</Button>
  </form>;
}

export function AuthenticatorReplacementForm({ existingFactorId }: { existingFactorId?: string | null }) {
  const [setup, setupAction, setupPending] = useActionState(startAuthenticatorReplacement, { message: "" });
  const [verification, verifyAction, verifyPending] = useActionState(verifyAuthenticatorReplacement, { message: "" });
  const enrollment = setup.enrollment;
  const factorId = enrollment?.factorId ?? existingFactorId ?? "";
  return <div className="mt-7">
    {!enrollment ? <form action={setupAction} className="grid gap-4">{setup.message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">{setup.message}</p>}<Button type="submit" disabled={setupPending}>{setupPending ? <><LoaderCircle size={18} className="animate-spin" />Starting secure replacement…</> : <><Smartphone size={18} />Set up replacement authenticator</>}</Button></form>
    : <div><ol className="grid gap-5 text-sm leading-6 text-[#344256]"><li><strong className="text-[#071127]">1. Scan this new QR code in your authenticator app.</strong><div className="mt-4 w-fit rounded-2xl border border-[#D7E0E9] bg-white p-4"><QrImage src={enrollment.qrCode} /></div><details className="mt-4 rounded-xl bg-[#F4F7FA] p-4"><summary className="cursor-pointer font-bold text-[#1446A5]">Can&apos;t scan it?</summary><code className="mt-3 block break-all rounded-lg bg-white p-3 font-mono text-sm font-bold text-[#071127]">{enrollment.secret}</code></details></li><li><strong className="text-[#071127]">2. Verify the replacement before the old authenticator is removed.</strong></li></ol></div>}
    {factorId && <form action={verifyAction} className="mt-5 grid gap-4"><input type="hidden" name="factorId" value={factorId} /><label className="text-sm font-bold text-[#071127]" htmlFor="replacement-code">Replacement authenticator code<input id="replacement-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="mt-2 block min-h-14 w-full rounded-xl border border-[#C9D5E2] px-4 text-center font-mono text-2xl font-black tracking-[0.35em] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15" /></label>{verification.message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{verification.message}</p>}<Button type="submit" disabled={verifyPending}>{verifyPending ? <><LoaderCircle size={18} className="animate-spin" />Verifying and revoking old access…</> : <><ShieldCheck size={18} />Verify and finish replacement</>}</Button></form>}
  </div>;
}
