import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentEntrySchema } from "@/lib/content/schema";
import {
  assertApplySafety,
  buildArticleImportPlan,
  enhancementCanonicalSlugs,
  getArticleImportBlockers,
  highIntentSourceFiles,
  loadHighIntentArticleProposals,
  parseArticleImportArgs,
  semanticCollisionReasons,
  validateArticleInternalLinks,
  type ExistingArticle,
} from "../../scripts/lib/high-intent-article-import";

const proposals = loadHighIntentArticleProposals();
const existing = (slug: string, title = slug.replaceAll("-", " "), seoTitle = title): ExistingArticle => ({
  id: crypto.randomUUID(),
  kind: "article",
  slug,
  title,
  excerpt: "Existing editorial content.",
  seo_title: seoTitle,
  status: "published",
  published_at: "2026-08-11T12:00:00.000Z",
});

describe("safe high-intent article draft import", () => {
  it("preserves all 20 source articles as 18 new drafts and two enhancement candidates", () => {
    const plan = buildArticleImportPlan(proposals, [
      existing("what-engine-management-light-means", "What Your Engine Management Light Is Really Telling You"),
      existing("why-car-battery-keeps-going-flat", "Why Does My Car Battery Keep Going Flat?"),
    ]);

    expect(proposals).toHaveLength(20);
    expect(new Set(proposals.map((proposal) => proposal.sourceSlug)).size).toBe(20);
    expect(plan.summary).toEqual({ NEW_DRAFT: 18, ENHANCEMENT_CANDIDATE: 2, EXISTING_EXACT_SLUG: 0, POTENTIAL_CONTENT_COLLISION: 0 });
    expect(plan.linkErrors).toEqual([]);
    expect(getArticleImportBlockers(plan)).toEqual([]);
  });

  it("validates every proposal with the real CMS schema and forces draft-only state", () => {
    for (const proposal of proposals) {
      expect(contentEntrySchema.safeParse(proposal.article).success, proposal.sourceSlug).toBe(true);
      expect(proposal.article.status).toBe("draft");
      expect(proposal.article.publishedAt).toBeUndefined();
    }
  });

  it("preserves both production canonicals as non-writing enhancement candidates", () => {
    expect(enhancementCanonicalSlugs).toEqual({
      "engine-warning-light-what-it-means": "what-engine-management-light-means",
      "car-battery-keeps-going-flat-overnight": "why-car-battery-keeps-going-flat",
    });
    const plan = buildArticleImportPlan(proposals, []);
    const enhancements = plan.items.filter((item) => item.disposition === "ENHANCEMENT_CANDIDATE");
    expect(enhancements.map((item) => [item.sourceSlug, item.canonicalSlug])).toEqual(Object.entries(enhancementCanonicalSlugs));
  });

  it("never creates an exact-slug duplicate", () => {
    const candidate = proposals.find((proposal) => proposal.sourceSlug === "car-limp-mode-causes")!;
    const plan = buildArticleImportPlan([candidate], [existing(candidate.sourceSlug)]);
    expect(plan.items[0]).toMatchObject({ disposition: "EXISTING_EXACT_SLUG", canonicalSlug: candidate.sourceSlug });
    expect(getArticleImportBlockers(plan)).toEqual(expect.arrayContaining([expect.stringMatching(/exact slug collision/i)]));
  });

  it("flags a meaningful title or SEO collision for editorial review", () => {
    const candidate = proposals.find((proposal) => proposal.sourceSlug === "car-electrical-problems-signs")!;
    const collision = existing("signs-of-car-electrical-problems", "Signs of Car Electrical Problems", candidate.article.seoTitle);
    expect(semanticCollisionReasons(candidate.article, collision)).toContain("duplicate SEO title");
    expect(buildArticleImportPlan([candidate], [collision]).items[0]?.disposition).toBe("POTENTIAL_CONTENT_COLLISION");
  });

  it("validates every internal path and rewrites discarded proposed canonicals", () => {
    expect(validateArticleInternalLinks(proposals, [])).toEqual([]);
    const serialized = JSON.stringify(proposals);
    expect(serialized).not.toContain("/news/engine-warning-light-what-it-means");
    expect(serialized).not.toContain("/news/car-battery-keeps-going-flat-overnight");
    expect(serialized).toContain("/news/what-engine-management-light-means");
    expect(serialized).toContain("/news/why-car-battery-keeps-going-flat");
  });

  it("keeps editorial sources non-executable and out of the migration directory", () => {
    for (const file of highIntentSourceFiles) {
      const source = readFileSync(`content/article-imports/high-intent/${file}`, "utf8");
      expect(source).not.toMatch(/insert\s+into|publication_status|published_at|\bnow\s*\(/i);
    }
    for (const part of [1, 2, 3, 4]) {
      expect(existsSync(`supabase/migrations/20260813000${part}_seed_high_intent_articles_${["diagnostics", "mechanical", "electrical", "engine_commercial"][part - 1]}.sql`)).toBe(false);
    }
  });

  it("requires explicit mode, admin authentication and double confirmation for production apply", () => {
    expect(() => parseArticleImportArgs([])).toThrow(/exactly one mode/);
    expect(parseArticleImportArgs(["--dry-run"])).toMatchObject({ mode: "dry-run" });
    const apply = parseArticleImportArgs(["--apply", "--environment=production", "--confirm-production=IMPORT_REVIEWED_DRAFTS"]);
    expect(() => assertApplySafety(apply, "production", {})).toThrow(/ADMIN_ACCESS_TOKEN/);
    expect(() => assertApplySafety(apply, "production", { ARTICLE_IMPORT_ADMIN_ACCESS_TOKEN: "token" })).toThrow(/both/);
    expect(() => assertApplySafety(apply, "production", {
      ARTICLE_IMPORT_ADMIN_ACCESS_TOKEN: "token",
      ARTICLE_IMPORT_PRODUCTION_APPROVED: "IMPORT_REVIEWED_DRAFTS",
    })).not.toThrow();
  });

  it("uses one authenticated transactional RPC with draft and audit invariants", () => {
    const migration = readFileSync("supabase/migrations/202608130005_import_article_drafts.sql", "utf8");
    expect(migration.trim()).toMatch(/^begin;[\s\S]*commit;$/);
    expect(migration).toContain("actor_id uuid := auth.uid()");
    expect(migration).toContain("not public.is_admin()");
    expect(migration).toContain("article->>'status' <> 'draft'");
    expect(migration).toContain("'draft'::public.publication_status");
    expect(migration).toContain("'import_draft'");
    expect(migration).toContain("'reviewed editorial import'");
    expect(migration).toContain("grant execute on function public.import_article_drafts(jsonb,text)");
    expect(migration).not.toMatch(/grant execute[\s\S]{0,100}service_role/i);
  });

  it("keeps drafts out of public news, sitemap and RSS data sources", () => {
    const repository = readFileSync("src/lib/news/repository.ts", "utf8");
    const contentRepository = readFileSync("src/lib/content/repository.ts", "utf8");
    const feed = readFileSync("src/app/news/feed.xml/route.ts", "utf8");
    expect(repository).toContain('.eq("status", "published")');
    expect(contentRepository).toContain('.eq("status", "published")');
    expect(feed).toContain("getPublishedArticles(50)");
  });
});
