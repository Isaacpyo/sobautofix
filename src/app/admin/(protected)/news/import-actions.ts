"use server";

import { revalidatePath } from "next/cache";
import {
  applyHighIntentArticleImport,
  previewHighIntentArticleImport,
  type AdminArticleImportPreview,
} from "@/lib/content/high-intent-article-admin";

export type ArticleImportActionState = {
  status: "idle" | "preview" | "success" | "error";
  message: string;
  preview?: AdminArticleImportPreview;
};

export async function previewHighIntentArticleImportAction(
  _: ArticleImportActionState,
  _formData: FormData,
): Promise<ArticleImportActionState> {
  void _;
  void _formData;
  try {
    const preview = await previewHighIntentArticleImport();
    return {
      status: "preview",
      message: preview.canApply
        ? `${preview.summary.NEW_DRAFT} new drafts and ${preview.summary.ENHANCEMENT_CANDIDATE} enhancement candidates are ready for review.`
        : "The import is blocked until every reported issue is resolved.",
      preview,
    };
  } catch (error) {
    return { status: "error", message: `INVALID: ${safeMessage(error)}` };
  }
}

export async function applyHighIntentArticleImportAction(
  _: ArticleImportActionState,
  formData: FormData,
): Promise<ArticleImportActionState> {
  try {
    const result = await applyHighIntentArticleImport(String(formData.get("confirmation") || ""));
    revalidatePath("/admin/news");
    return {
      status: "success",
      message: `${result.imported} article drafts imported successfully. ${result.enhancements} existing articles remain unchanged as enhancement candidates.`,
    };
  } catch (error) {
    return { status: "error", message: safeMessage(error) };
  }
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "The article import could not be completed.";
  return message === "Unauthorised" ? "You are not authorised to use the article importer." : message;
}
