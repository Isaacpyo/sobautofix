import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { contentEntrySchema } from "@/lib/content/schema";
import { diagnostics, services } from "@/config/site";
import type { ContentEntryInput } from "@/lib/content/schema";

export const highIntentSourceFiles = [
  "diagnostics.article-source",
  "mechanical.article-source",
  "electrical.article-source",
  "engine-commercial.article-source",
] as const;

export const enhancementCanonicalSlugs = {
  "engine-warning-light-what-it-means": "what-engine-management-light-means",
  "car-battery-keeps-going-flat-overnight": "why-car-battery-keeps-going-flat",
} as const;

const canonicalLinkRewrites = new Map([
  ["/news/engine-warning-light-what-it-means", "/news/what-engine-management-light-means"],
  ["/news/car-battery-keeps-going-flat-overnight", "/news/why-car-battery-keeps-going-flat"],
]);

const sourceRow = new RegExp([
  "\\(\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)',",
  "\\s*\\$body\\$([\\s\\S]*?)\\$body\\$,",
  "\\s*\\$faqs\\$([\\s\\S]*?)\\$faqs\\$::jsonb,",
  "\\s*\\$links\\$([\\s\\S]*?)\\$links\\$::jsonb,",
  "\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)',",
  "\\s*'((?:''|[^'])*)'(?:,\\s*(true|false))?\\s*\\)",
].join(""), "g");

type ValidatedArticle = ReturnType<typeof contentEntrySchema.parse>;

export type ArticleProposal = {
  sourceFile: string;
  sourceSlug: string;
  canonicalTarget?: string;
  article: ValidatedArticle;
};

export type ExistingArticle = {
  id: string;
  kind: string;
  slug: string;
  title: string;
  excerpt: string;
  seo_title: string;
  status: string;
  published_at: string | null;
  sections?: unknown;
};

export type ImportDisposition =
  | "NEW_DRAFT"
  | "ENHANCEMENT_CANDIDATE"
  | "EXISTING_EXACT_SLUG"
  | "POTENTIAL_CONTENT_COLLISION";

export type ImportPlanItem = {
  sourceSlug: string;
  canonicalSlug: string;
  disposition: ImportDisposition;
  article: ValidatedArticle;
  matches: Array<{ slug: string; title: string; status: string; reasons: string[] }>;
};

export type ImportPlan = {
  items: ImportPlanItem[];
  linkErrors: string[];
  summary: Record<ImportDisposition, number>;
};

export function loadHighIntentArticleProposals(root = process.cwd()): ArticleProposal[] {
  const directory = resolve(root, "content", "article-imports", "high-intent");
  const proposals = highIntentSourceFiles.flatMap((sourceFile) => parseSourceFile(sourceFile, readFileSync(resolve(directory, sourceFile), "utf8")));
  const sourceSlugs = proposals.map((proposal) => proposal.sourceSlug);
  if (proposals.length !== 20) throw new Error(`INVALID_ARTICLE_INVENTORY: expected 20 articles, found ${proposals.length}`);
  if (new Set(sourceSlugs).size !== sourceSlugs.length) throw new Error("INVALID_ARTICLE_INVENTORY: duplicate source slug");
  return proposals;
}

function parseSourceFile(sourceFile: string, source: string): ArticleProposal[] {
  if (/insert\s+into\s+public\.content_entries|publication_status|published_at|\bnow\s*\(\s*\)/i.test(source)) {
    throw new Error(`UNSAFE_ARTICLE_SOURCE: ${sourceFile}`);
  }
  const proposals: ArticleProposal[] = [];
  sourceRow.lastIndex = 0;
  for (const match of source.matchAll(sourceRow)) {
    const sourceSlug = sqlText(match[1]);
    const canonicalTarget = enhancementCanonicalSlugs[sourceSlug as keyof typeof enhancementCanonicalSlugs];
    const rewrite = (value: string) => rewriteCanonicalLinks(sqlText(value));
    const body = rewrite(match[7] || "").trim();
    const faqs = JSON.parse(rewrite(match[8] || "[]")) as Array<{ question: string; answer: string }>;
    const links = JSON.parse(rewrite(match[9] || "[]")) as Array<{ label: string; href: string }>;
    const input: ContentEntryInput = {
      kind: "article",
      slug: canonicalTarget || sourceSlug,
      title: sqlText(match[2]),
      excerpt: sqlText(match[3]),
      sections: [
        { type: "richText", paragraphs: [body] },
        { type: "faqs", heading: "Frequently asked questions", items: faqs },
        { type: "relatedLinks", heading: "Related guides and services", links },
        { type: "cta", heading: sqlText(match[10]), body: sqlText(match[11]), label: sqlText(match[12]), href: rewrite(match[13] || "") },
      ],
      metadata: { category: sqlText(match[4]), author: "SOB Autofix Team", featured: match[14] === "true" },
      seoTitle: sqlText(match[5]),
      seoDescription: sqlText(match[6]),
      status: "draft",
    };
    const parsed = contentEntrySchema.safeParse(input);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "article"}: ${issue.message}`).join("; ");
      throw new Error(`INVALID_ARTICLE ${sourceSlug}: ${details}`);
    }
    proposals.push({ sourceFile, sourceSlug, canonicalTarget, article: parsed.data });
  }
  return proposals;
}

function sqlText(value: string | undefined) {
  return String(value || "").replaceAll("''", "'").trim();
}

function rewriteCanonicalLinks(value: string) {
  let result = value;
  for (const [from, to] of canonicalLinkRewrites) result = result.replaceAll(from, to);
  return result;
}

export function buildArticleImportPlan(proposals: ArticleProposal[], existing: ExistingArticle[]): ImportPlan {
  const items = proposals.map((proposal): ImportPlanItem => {
    if (proposal.canonicalTarget) {
      const canonical = existing.find((entry) => entry.kind === "article" && entry.slug === proposal.canonicalTarget);
      return {
        sourceSlug: proposal.sourceSlug,
        canonicalSlug: proposal.canonicalTarget,
        disposition: "ENHANCEMENT_CANDIDATE",
        article: proposal.article,
        matches: canonical ? [{ slug: canonical.slug, title: canonical.title, status: canonical.status, reasons: ["preserved canonical mapping"] }] : [],
      };
    }
    const exact = existing.find((entry) => entry.kind === "article" && entry.slug === proposal.article.slug);
    if (exact) {
      return {
        sourceSlug: proposal.sourceSlug,
        canonicalSlug: proposal.article.slug,
        disposition: "EXISTING_EXACT_SLUG",
        article: proposal.article,
        matches: [{ slug: exact.slug, title: exact.title, status: exact.status, reasons: ["exact kind and slug"] }],
      };
    }
    const semanticMatches = existing.flatMap((entry) => {
      if (entry.kind !== "article") return [];
      const reasons = semanticCollisionReasons(proposal.article, entry);
      return reasons.length ? [{ slug: entry.slug, title: entry.title, status: entry.status, reasons }] : [];
    });
    return {
      sourceSlug: proposal.sourceSlug,
      canonicalSlug: proposal.article.slug,
      disposition: semanticMatches.length ? "POTENTIAL_CONTENT_COLLISION" : "NEW_DRAFT",
      article: proposal.article,
      matches: semanticMatches,
    };
  });
  const linkErrors = validateArticleInternalLinks(proposals, existing);
  return {
    items,
    linkErrors,
    summary: {
      NEW_DRAFT: items.filter((item) => item.disposition === "NEW_DRAFT").length,
      ENHANCEMENT_CANDIDATE: items.filter((item) => item.disposition === "ENHANCEMENT_CANDIDATE").length,
      EXISTING_EXACT_SLUG: items.filter((item) => item.disposition === "EXISTING_EXACT_SLUG").length,
      POTENTIAL_CONTENT_COLLISION: items.filter((item) => item.disposition === "POTENTIAL_CONTENT_COLLISION").length,
    },
  };
}

export function semanticCollisionReasons(article: ValidatedArticle, existing: ExistingArticle) {
  const reasons: string[] = [];
  const titleScore = tokenSimilarity(article.title, existing.title);
  const slugScore = tokenSimilarity(article.slug.replaceAll("-", " "), existing.slug.replaceAll("-", " "));
  if (normalize(article.seoTitle) === normalize(existing.seo_title)) reasons.push("duplicate SEO title");
  if (titleScore >= 0.62) reasons.push(`normalized title similarity ${titleScore.toFixed(2)}`);
  if (slugScore >= 0.72) reasons.push(`normalized slug similarity ${slugScore.toFixed(2)}`);
  return reasons;
}

const stopWords = new Set(["a", "an", "and", "are", "but", "can", "car", "common", "do", "does", "for", "from", "how", "is", "it", "my", "of", "on", "or", "the", "to", "uk", "what", "when", "why", "with", "your"]);

function normalize(value: string) {
  return tokens(value).join(" ");
}

function tokens(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((token) => token && !stopWords.has(token));
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

const publicPaths = new Set([
  "/", "/book", "/contact", "/diagnostics", "/get-a-quote", "/mobile-mechanic", "/news", "/services",
  "/services/mobile-specialist", "/services/repairs-maintenance",
  ...services.filter((service) => service.published).map((service) => `/services/${service.slug}`),
  ...diagnostics.filter((diagnostic) => diagnostic.published).map((diagnostic) => `/diagnostics/${diagnostic.slug}`),
]);

export function validateArticleInternalLinks(proposals: ArticleProposal[], existing: ExistingArticle[]) {
  const futureArticles = new Set(proposals.map((proposal) => `/news/${proposal.canonicalTarget || proposal.sourceSlug}`));
  const existingArticles = new Set(existing.filter((entry) => entry.kind === "article").map((entry) => `/news/${entry.slug}`));
  const errors: string[] = [];
  for (const proposal of proposals) {
    const serialized = JSON.stringify(proposal.article.sections);
    const paths = [
      ...serialized.matchAll(/"href":"(\/[a-z0-9/-]+)"/g),
      ...serialized.matchAll(/\[[^\]]+\]\((\/[a-z0-9/-]+)\)/g),
    ].map((match) => match[1] || "");
    for (const path of new Set(paths)) {
      if (canonicalLinkRewrites.has(path)) errors.push(`${proposal.sourceSlug}: discarded canonical path remains ${path}`);
      else if (!publicPaths.has(path) && !futureArticles.has(path) && !existingArticles.has(path)) errors.push(`${proposal.sourceSlug}: unresolved internal path ${path}`);
    }
  }
  return [...new Set(errors)];
}

export function loadEnvFile(root = process.cwd()) {
  const path = resolve(root, ".env.local");
  let source = "";
  try { source = readFileSync(path, "utf8"); } catch { return; }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || rawValue === undefined || process.env[key]) continue;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

type CliOptions = { mode: "dry-run" | "apply"; environment?: "local" | "production"; confirmProduction?: string; json: boolean };

export function parseArticleImportArgs(args: string[]): CliOptions {
  const mode = args.includes("--apply") ? "apply" : args.includes("--dry-run") ? "dry-run" : null;
  if (!mode || (args.includes("--apply") && args.includes("--dry-run"))) throw new Error("Choose exactly one mode: --dry-run or --apply");
  const environmentValue = argumentValue(args, "--environment");
  if (environmentValue && environmentValue !== "local" && environmentValue !== "production") throw new Error("--environment must be local or production");
  return { mode, environment: environmentValue as CliOptions["environment"], confirmProduction: argumentValue(args, "--confirm-production"), json: args.includes("--json") };
}

function argumentValue(args: string[], name: string) {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function assertApplySafety(
  options: CliOptions,
  target: "local" | "production",
  env: Record<string, string | undefined> = process.env,
) {
  if (options.mode !== "apply") return;
  if (!options.environment) throw new Error("Apply requires an explicit --environment local|production");
  if (options.environment !== target) throw new Error(`Target URL is ${target}, not ${options.environment}`);
  if (!env.ARTICLE_IMPORT_ADMIN_ACCESS_TOKEN) throw new Error("Apply requires ARTICLE_IMPORT_ADMIN_ACCESS_TOKEN for an authenticated CMS admin");
  if (target === "production") {
    const confirmation = "IMPORT_REVIEWED_DRAFTS";
    if (options.confirmProduction !== confirmation || env.ARTICLE_IMPORT_PRODUCTION_APPROVED !== confirmation) {
      throw new Error("Production apply requires both --confirm-production=IMPORT_REVIEWED_DRAFTS and ARTICLE_IMPORT_PRODUCTION_APPROVED=IMPORT_REVIEWED_DRAFTS");
    }
  }
}

function targetForUrl(value: string): "local" | "production" {
  const hostname = new URL(value).hostname;
  return ["localhost", "127.0.0.1", "::1"].includes(hostname) ? "local" : "production";
}

export async function runArticleImportCli(args: string[], root = process.cwd()) {
  loadEnvFile(root);
  const options = parseArticleImportArgs(args);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const readKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !readKey || !publishableKey) throw new Error("Supabase URL, publishable key and secret key are required");
  const target = targetForUrl(url);
  assertApplySafety(options, target);

  const readClient = createClient(url, readKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const response = await readClient.from("content_entries").select("id,kind,slug,title,excerpt,seo_title,status,published_at,sections");
  if (response.error) throw new Error(`Existing CMS content could not be read: ${response.error.message}`);
  const existing = (response.data || []) as ExistingArticle[];
  const proposals = loadHighIntentArticleProposals(root);
  const plan = buildArticleImportPlan(proposals, existing);

  let writes = 0;
  if (options.mode === "apply") {
    if (plan.linkErrors.length) throw new Error(`Import blocked by internal links: ${plan.linkErrors.join("; ")}`);
    if (plan.summary.POTENTIAL_CONTENT_COLLISION) throw new Error("Import blocked until all potential content collisions are reviewed");
    const drafts = plan.items.filter((item) => item.disposition === "NEW_DRAFT").map((item) => item.article);
    const adminClient = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${process.env.ARTICLE_IMPORT_ADMIN_ACCESS_TOKEN}` } },
    });
    const applied = await adminClient.rpc("import_article_drafts", { p_articles: drafts, p_source: "reviewed editorial import" });
    if (applied.error) throw new Error(`Draft import failed atomically: ${applied.error.message}`);
    writes = Array.isArray(applied.data) ? applied.data.length : 0;
    if (writes !== drafts.length) throw new Error(`Draft import returned ${writes} rows for ${drafts.length} planned drafts`);
  }

  const report = { target, mode: options.mode, inventory: proposals.length, plan, writes };
  if (options.json) process.stdout.write(`${JSON.stringify(report)}\n`);
  else printPlan(report);
  return report;
}

function printPlan(report: { target: string; mode: string; inventory: number; plan: ImportPlan; writes: number }) {
  process.stdout.write(`Article import ${report.mode} | target ${report.target} | inventory ${report.inventory}\n`);
  for (const item of report.plan.items) {
    const mapping = item.sourceSlug === item.canonicalSlug ? item.canonicalSlug : `${item.sourceSlug} -> ${item.canonicalSlug}`;
    const matches = item.matches.length ? ` | ${item.matches.map((match) => `${match.slug}: ${match.reasons.join(", ")}`).join("; ")}` : "";
    process.stdout.write(`${item.disposition} | ${mapping}${matches}\n`);
  }
  for (const error of report.plan.linkErrors) process.stdout.write(`INVALID_LINK | ${error}\n`);
  process.stdout.write(`Summary | ${Object.entries(report.plan.summary).map(([key, value]) => `${key}=${value}`).join(" ")}\n`);
  process.stdout.write(`Production writes | ${report.writes}\n`);
}
