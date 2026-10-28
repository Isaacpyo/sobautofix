import { AlertTriangle, DatabaseZap, Lock } from "lucide-react";
import { SCHEMA_MISSING_MESSAGE } from "@/lib/exchange/schema";

export function NotPermitted({ what = "this page" }: { what?: string }) {
  return (
    <div className="rounded-2xl border border-[#E3E8EF] bg-white p-8 text-center">
      <Lock className="mx-auto text-[#5B6575]" aria-hidden="true" />
      <h1 className="mt-3 text-xl font-extrabold text-[#0B1220]">You do not have access to {what}</h1>
      <p className="mt-2 text-sm text-[#5B6575]">Ask the owner to change your staff role if you need it.</p>
    </div>
  );
}

export function SchemaMissingNotice() {
  return (
    <div role="status" className="flex gap-3 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm text-[#7A2E0E]">
      <DatabaseZap size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>{SCHEMA_MISSING_MESSAGE}</p>
    </div>
  );
}

export function LoadFailedNotice({ what = "the diary" }: { what?: string }) {
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] p-4 text-sm text-[#B42318]">
      <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>Some of {what} could not be loaded. Refresh the page to try again.</p>
    </div>
  );
}
