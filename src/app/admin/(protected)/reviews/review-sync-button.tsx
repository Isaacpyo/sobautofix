"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { syncGoogleReviews, type ReviewSyncState } from "../actions";

const initialState: ReviewSyncState = { status: "idle", message: "" };

export function ReviewSyncButton() {
  const [state, action, pending] = useActionState(syncGoogleReviews, initialState);
  return <div className="grid justify-items-end gap-2"><form action={action}><button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1974E2] px-4 font-bold text-white disabled:opacity-60">{pending && <LoaderCircle size={17} className="animate-spin" />}{pending ? "Syncing…" : "Sync Google reviews"}</button></form>{state.message && <p role="status" className={`max-w-md text-right text-xs font-semibold ${state.status === "error" ? "text-red-800" : "text-green-800"}`}>{state.message}</p>}</div>;
}
