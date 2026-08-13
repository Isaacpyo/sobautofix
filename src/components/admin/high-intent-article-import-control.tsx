"use client";

import { useActionState } from "react";
import {
  applyHighIntentArticleImportAction,
  previewHighIntentArticleImportAction,
  type ArticleImportActionState,
} from "@/app/admin/(protected)/news/import-actions";

const initialState: ArticleImportActionState = { status: "idle", message: "" };

export function HighIntentArticleImportControl({ completed }: { completed: boolean }) {
  const [previewState, previewAction, previewPending] = useActionState(previewHighIntentArticleImportAction, initialState);
  const [applyState, applyAction, applyPending] = useActionState(applyHighIntentArticleImportAction, initialState);
  const importCompleted = completed || applyState.status === "success";

  return (
    <section className="mt-8 rounded-2xl border border-[#B8D4F7] bg-[#F4F8FE] p-6" aria-labelledby="high-intent-import-heading">
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">One-time editorial operation</p>
      <h2 id="high-intent-import-heading" className="mt-2 text-2xl font-extrabold text-[#071127]">High-intent article import</h2>
      {importCompleted ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-bold">High-intent draft import completed</p>
          <p className="mt-1">The protected apply control is disabled. Review and publish each article separately through the CMS.</p>
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#586575]">Preview the live CMS plan before importing. A clean import creates drafts only, schedules nothing, publishes nothing, and leaves both existing canonical articles unchanged.</p>
          <form action={previewAction} className="mt-5">
            <button type="submit" disabled={previewPending || applyPending} className="min-h-11 rounded-lg bg-[#071127] px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {previewPending ? "Checking production content…" : "Preview Import"}
            </button>
          </form>
          {previewState.status !== "idle" && (
            <div className={`mt-5 rounded-xl border p-4 text-sm ${previewState.status === "error" || !previewState.preview?.canApply ? "border-red-200 bg-red-50 text-red-900" : "border-green-200 bg-green-50 text-green-900"}`} aria-live="polite">
              <p className="font-bold">{previewState.message}</p>
              {previewState.preview && <ImportPreviewDetails preview={previewState.preview} />}
            </div>
          )}
          {previewState.status === "preview" && previewState.preview?.canApply && (
            <form action={applyAction} className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
              <h3 className="font-extrabold text-[#071127]">Confirm draft-only import</h3>
              <p className="mt-2 text-sm leading-6 text-[#5F4B16]">Import {previewState.preview.summary.NEW_DRAFT} reviewed articles as drafts? Nothing will be published or scheduled, and the two existing canonical articles will not be changed.</p>
              <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-[#3E3212]">
                <input type="checkbox" name="confirmation" value="IMPORT_18_REVIEWED_DRAFTS" required className="mt-1 size-4" />
                I confirm this is a draft-only import and that existing canonical articles must remain untouched.
              </label>
              <button type="submit" disabled={applyPending} className="mt-4 min-h-11 rounded-lg bg-[#B45309] px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {applyPending ? "Importing drafts…" : `Import ${previewState.preview.summary.NEW_DRAFT} Drafts`}
              </button>
            </form>
          )}
          {applyState.status !== "idle" && (
            <p className={`mt-5 rounded-xl border p-4 text-sm font-bold ${applyState.status === "success" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`} aria-live="polite">{applyState.message}</p>
          )}
        </>
      )}
    </section>
  );
}

function ImportPreviewDetails({ preview }: { preview: NonNullable<ArticleImportActionState["preview"]> }) {
  return (
    <div className="mt-4 text-[#26364A]">
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="New drafts" value={preview.summary.NEW_DRAFT} />
        <Summary label="Enhancements" value={preview.summary.ENHANCEMENT_CANDIDATE} />
        <Summary label="Exact collisions" value={preview.summary.EXISTING_EXACT_SLUG} />
        <Summary label="Potential collisions" value={preview.summary.POTENTIAL_CONTENT_COLLISION} />
      </dl>
      {preview.blockers.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5">{preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
      <details className="mt-4">
        <summary className="cursor-pointer font-bold">Show all {preview.inventory} dispositions</summary>
        <ul className="mt-3 space-y-2">
          {preview.items.map((item) => (
            <li key={item.sourceSlug} className="rounded-lg bg-white/80 px-3 py-2">
              <span className="font-bold">{item.disposition}</span> — {item.sourceSlug}{item.sourceSlug !== item.canonicalSlug ? ` → ${item.canonicalSlug}` : ""}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-white/80 p-3"><dt className="text-xs font-bold tracking-wide text-[#667586] uppercase">{label}</dt><dd className="mt-1 text-2xl font-extrabold text-[#071127]">{value}</dd></div>;
}
