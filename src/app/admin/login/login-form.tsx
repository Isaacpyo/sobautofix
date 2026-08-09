"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestLogin } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(requestLogin, { message: "" });
  return <form action={action} className="mt-8 grid gap-5"><label className="text-sm font-bold text-[#071127]">Staff email<input name="email" type="email" required autoComplete="email" className="mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] px-4" /></label>{state.message && <p className="rounded-lg bg-[#F4F7FA] p-3 text-sm text-[#586575]" role="status">{state.message}</p>}<Button disabled={pending} type="submit">{pending ? "Sending…" : "Send secure sign-in link"}</Button></form>;
}
