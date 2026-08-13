"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AdminLoadingModal } from "@/components/admin/admin-loading-modal";
import { Button } from "@/components/ui/button";
import { loginWithPassword } from "./actions";

export function LoginForm({ resetComplete = false }: { resetComplete?: boolean }) {
  const [state, action, pending] = useActionState(loginWithPassword, { message: "" });
  return (
    <form action={action} className="mt-8 grid gap-5">
      <label className="text-sm font-bold text-[#071127]">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4"
        />
      </label>
      <label className="text-sm font-bold text-[#071127]">
        <span className="flex items-center justify-between gap-3">Password<Link href="/admin/forgot-password" className="text-xs font-bold text-[#1974E2] hover:underline">Forgot password?</Link></span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4"
        />
      </label>
      {resetComplete && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">Password updated. Sign in with your new password.</p>}
      {state.message && (
        <p className="rounded-lg bg-[#F4F7FA] p-3 text-sm text-[#586575]" role="alert">
          {state.message}
        </p>
      )}
      <Button disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {pending && <AdminLoadingModal title="Signing in" description="Please wait while your secure admin dashboard loads." />}
    </form>
  );
}
