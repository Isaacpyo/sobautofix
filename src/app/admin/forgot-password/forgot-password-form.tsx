"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { requestPasswordReset } from "../login/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, { message: "" });
  return (
    <form action={action} className="mt-8 grid gap-5">
      <label className="text-sm font-bold text-[#071127]">Admin email
        <input name="email" type="email" required autoComplete="email" className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4 outline-none focus:border-[#168BFF] focus:ring-4 focus:ring-[#168BFF]/10" />
      </label>
      {state.message && <p className="rounded-lg bg-[#F4F7FA] p-3 text-sm leading-6 text-[#586575]" role="status">{state.message}</p>}
      <Button disabled={pending} type="submit">{pending ? "Sending…" : "Send reset link"}</Button>
      <BackLink href="/admin/login" className="justify-center">Back to sign in</BackLink>
    </form>
  );
}
