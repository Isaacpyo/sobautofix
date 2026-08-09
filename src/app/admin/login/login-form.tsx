"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ADMIN_EMAIL } from "@/config/admin";
import { loginWithPassword } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginWithPassword, { message: "" });
  return (
    <form action={action} className="mt-8 grid gap-5">
      <div>
        <span className="text-sm font-bold text-[#071127]">Admin email</span>
        <p className="mt-2 flex min-h-12 items-center rounded-xl border border-[#D7E0E9] bg-[#F4F7FA] px-4 text-[#586575]">
          {ADMIN_EMAIL}
        </p>
      </div>
      <label className="text-sm font-bold text-[#071127]">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4"
        />
      </label>
      {state.message && (
        <p className="rounded-lg bg-[#F4F7FA] p-3 text-sm text-[#586575]" role="alert">
          {state.message}
        </p>
      )}
      <Button disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
