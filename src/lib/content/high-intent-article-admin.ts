import "server-only";

import { getAdminUser } from "@/lib/supabase/server";
import {
  buildArticleImportPlan,
  expectedHighIntentDraftCount,
  expectedHighIntentEnhancementCount,
  getArticleImportBlockers,
  loadHighIntentArticleProposals,
  type ExistingArticle,
  type ImportPlan,
} from "../../../scripts/lib/high-intent-article-import";

type AdminSession = NonNullable<Awaited<ReturnType<typeof getAdminUser>>>;

export type AdminArticleImportPreview = {
  inventory: number;
  summary: ImportPlan["summary"];
  items: Array<{
    sourceSlug: string;
    canonicalSlug: string;
    disposition: ImportPlan["items"][number]["disposition"];
    matches: Array<{ slug: string; reasons: string[] }>;
  }>;
  blockers: string[];
  canApply: boolean;
};

export const articleImportConfirmation = "IMPORT_18_REVIEWED_DRAFTS";

async function requireArticleImportAdmin(): Promise<AdminSession> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Unauthorised");
  return admin;
}

async function readExistingContent(client: AdminSession["client"]): Promise<ExistingArticle[]> {
  const { data, error } = await client
    .from("content_entries")
    .select("id,kind,slug,title,excerpt,seo_title,status,published_at,sections");
  if (error) throw new Error("CMS content could not be read for import planning.");
  return (data || []) as ExistingArticle[];
}

async function buildFreshPlan(client: AdminSession["client"]) {
  const proposals = loadHighIntentArticleProposals();
  const plan = buildArticleImportPlan(proposals, await readExistingContent(client));
  return { proposals, plan, blockers: getArticleImportBlockers(plan) };
}

export async function previewHighIntentArticleImport(): Promise<AdminArticleImportPreview> {
  const { client } = await requireArticleImportAdmin();
  const { proposals, plan, blockers } = await buildFreshPlan(client);
  return {
    inventory: proposals.length,
    summary: plan.summary,
    items: plan.items.map((item) => ({
      sourceSlug: item.sourceSlug,
      canonicalSlug: item.canonicalSlug,
      disposition: item.disposition,
      matches: item.matches.map((match) => ({ slug: match.slug, reasons: match.reasons })),
    })),
    blockers,
    canApply: blockers.length === 0,
  };
}

export async function applyHighIntentArticleImport(confirmation: string) {
  if (confirmation !== articleImportConfirmation) throw new Error("Explicit draft-import confirmation is required.");
  const { client } = await requireArticleImportAdmin();
  const { plan, blockers } = await buildFreshPlan(client);
  if (blockers.length) throw new Error(`Import blocked: ${blockers.join(" ")}`);

  const drafts = plan.items
    .filter((item) => item.disposition === "NEW_DRAFT")
    .map((item) => item.article);
  if (drafts.length !== expectedHighIntentDraftCount) throw new Error("The reviewed draft inventory changed before apply.");

  const { data, error } = await client.rpc("import_article_drafts", {
    p_articles: drafts,
    p_source: "reviewed editorial import",
  });
  if (error) throw new Error("Draft import was rejected atomically. Refresh and preview again; no partial batch was retained.");
  const imported = Array.isArray(data) ? data.length : 0;
  if (imported !== expectedHighIntentDraftCount) throw new Error(`Draft import returned ${imported} rows instead of ${expectedHighIntentDraftCount}.`);
  return { imported, enhancements: expectedHighIntentEnhancementCount };
}

export async function isHighIntentArticleImportComplete() {
  const { client } = await requireArticleImportAdmin();
  const draftSlugs = loadHighIntentArticleProposals()
    .filter((proposal) => !proposal.canonicalTarget)
    .map((proposal) => proposal.article.slug);
  const { data: entries, error: entryError } = await client
    .from("content_entries")
    .select("id,slug")
    .eq("kind", "article")
    .in("slug", draftSlugs);
  if (entryError || entries?.length !== expectedHighIntentDraftCount) return false;

  const entryIds = entries.map((entry) => entry.id);
  const { data: auditRows, error: auditError } = await client
    .from("admin_audit_log")
    .select("entity_id")
    .eq("action", "import_draft")
    .eq("entity_type", "article")
    .in("entity_id", entryIds);
  if (auditError) return false;
  return new Set((auditRows || []).map((row) => row.entity_id)).size === expectedHighIntentDraftCount;
}
