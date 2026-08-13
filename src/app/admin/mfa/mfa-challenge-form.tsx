"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/admin/login/actions";
import { verifyMfaChallenge } from "./actions";

export function MfaChallengeForm({ factorId, returnTo }: { factorId: string; returnTo: string }) {
  const [state, action, pending] = useActionState(verifyMfaChallenge, { message: "" });
  return (
    <>
      <form action={action} className="mt-7 grid gap-5">
        <input type="hidden" name="factorId" value={factorId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="text-sm font-bold text-[#071127]" htmlFor="mfa-code">Verification code
          <input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus className="mt-2 block min-h-14 w-full rounded-xl border border-[#C9D5E2] px-4 text-center font-mono text-2xl font-black tracking-[0.35em] outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15" />
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[#D7E0E9] bg-[#F8FAFC] p-4 text-sm text-[#071127]">
          <input type="checkbox" name="trustDevice" value="yes" className="mt-0.5 size-4 accent-[#1974E2]" />
          <span><strong className="block">Trust this device for 7 days</strong><span className="mt-1 block leading-5 text-[#586575]">Only select this on a private device you control. Sensitive security changes will still require your authenticator.</span></span>
        </label>
        {state.message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{state.message}</p>}
        <Button type="submit" disabled={pending}>{pending ? <><LoaderCircle size={18} className="animate-spin" />Verifying…</> : <><ShieldCheck size={18} />Verify</>}</Button>
      </form>
      <Link href="/admin/mfa/recover" className="mt-4 block min-h-11 text-center text-sm font-bold leading-11 text-[#1974E2] hover:text-[#1446A5]">Lost your authenticator?</Link>
      <form action={signOut} className="mt-4"><button className="min-h-11 w-full text-sm font-bold text-[#586575] hover:text-[#1974E2]">Use another account</button></form>
    </>
  );
}
