"use client";

import { LoaderCircle, RotateCw } from "lucide-react";
import { useActionState } from "react";
import type { DiaryFormState } from "@/lib/diary/form-state";
import { cn } from "@/lib/utils";

type RowAction = (state: DiaryFormState, formData: FormData) => Promise<DiaryFormState>;
type SweepAction = (state: DiaryFormState) => Promise<DiaryFormState>;

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]";

function Message({ state }: { state: DiaryFormState }) {
  if (state.status === "idle") return null;
  return <p role={state.status === "error" ? "alert" : "status"} className={cn("text-sm font-semibold", state.status === "error" ? "text-[#B42318]" : "text-[#067647]")}>{state.message}</p>;
}

export function RetryNotificationButton({ enquiryId, label, action }: { enquiryId: string; label: string; action: RowAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as DiaryFormState);
  return (
    <form action={formAction} className="grid justify-items-end gap-1">
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <button type="submit" disabled={pending} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-[#B42318] ring-1 ring-[#FDA29B] hover:bg-[#FEF3F2] disabled:opacity-60", focusRing)}>
        {pending ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RotateCw size={15} aria-hidden="true" />} Retry now<span className="sr-only">: {label}</span>
      </button>
      <Message state={state} />
    </form>
  );
}

export function RunSweepButton({ action }: { action: SweepAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as DiaryFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <button type="submit" disabled={pending} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm font-bold text-[#0B1220] hover:border-[#1974E2] disabled:opacity-60", focusRing)}>
        {pending ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RotateCw size={15} aria-hidden="true" />} Retry everything due
      </button>
      <Message state={state} />
    </form>
  );
}
