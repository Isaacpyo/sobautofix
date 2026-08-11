"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetAdminPassword } from "../login/actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetAdminPassword, { message: "" });
  return (
    <form action={action} className="mt-8 grid gap-5">
      <label className="text-sm font-bold text-[#071127]">New password
        <input name="password" type="password" required minLength={12} autoComplete="new-password" className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4 outline-none focus:border-[#168BFF] focus:ring-4 focus:ring-[#168BFF]/10" />
      </label>
      <label className="text-sm font-bold text-[#071127]">Confirm new password
        <input name="confirmPassword" type="password" required minLength={12} autoComplete="new-password" className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4 outline-none focus:border-[#168BFF] focus:ring-4 focus:ring-[#168BFF]/10" />
      </label>
      <p className="text-xs leading-5 text-[#667586]">Use at least 12 characters and avoid reusing a password from another account.</p>
      {state.message && <p className="rounded-lg bg-[#F4F7FA] p-3 text-sm leading-6 text-[#586575]" role="alert">{state.message}</p>}
      <Button disabled={pending} type="submit">{pending ? "Updating…" : "Update password"}</Button>
    </form>
  );
}
