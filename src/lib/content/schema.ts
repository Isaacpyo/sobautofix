import { z } from "zod";
import { assertCustomerFacingContent } from "@/lib/content-guard";

const linkSchema = z.object({ label: z.string().min(1), href: z.string().startsWith("/") });
const reservedArticleSlugs = new Set(["feed", "rss", "index", "new", "admin"]);

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), eyebrow: z.string().optional(), title: z.string().min(1), body: z.string().min(1), primaryCta: z.string().optional() }),
  z.object({ type: z.literal("richText"), heading: z.string().optional(), paragraphs: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("serviceCards"), heading: z.string().min(1), slugs: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("vehicleLookup"), heading: z.string().optional(), body: z.string().optional() }),
  z.object({ type: z.literal("symptomSelector"), heading: z.string().min(1) }),
  z.object({ type: z.literal("process"), heading: z.string().min(1), steps: z.array(z.string().min(1)).min(2) }),
  z.object({ type: z.literal("trustFacts"), heading: z.string().optional(), facts: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1) }),
  z.object({ type: z.literal("offer"), offerId: z.string().min(1) }),
  z.object({ type: z.literal("reviews"), heading: z.string().min(1) }),
  z.object({ type: z.literal("areas"), heading: z.string().min(1) }),
  z.object({ type: z.literal("gallery"), heading: z.string().min(1), category: z.string().optional(), mediaIds: z.array(z.string().uuid()).optional() }),
  z.object({ type: z.literal("faqs"), heading: z.string().min(1), items: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(1) }),
  z.object({ type: z.literal("relatedLinks"), heading: z.string().min(1), links: z.array(linkSchema).min(1) }),
  z.object({ type: z.literal("cta"), heading: z.string().min(1), body: z.string().min(1), label: z.string().min(1), href: z.string().startsWith("/") }),
]);

export const contentEntrySchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["core_page", "service", "diagnostic", "area", "article", "faq"]),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(3),
  excerpt: z.string().min(10),
  sections: z.array(sectionSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  seoTitle: z.string().min(10).max(70),
  seoDescription: z.string().min(30).max(170),
  status: z.enum(["draft", "scheduled", "published", "archived"]),
  publishedAt: z.string().datetime().optional(),
}).superRefine((value, context) => {
  if (value.kind === "article" && reservedArticleSlugs.has(value.slug)) {
    context.addIssue({ code: "custom", path: ["slug"], message: "Choose a different article URL" });
  }
  if (value.status === "scheduled" && !value.publishedAt) {
    context.addIssue({ code: "custom", path: ["publishedAt"], message: "Choose a publication time for scheduled content" });
  }
  try {
    assertCustomerFacingContent(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Unsafe content" });
  }
});

export type ContentEntryInput = z.input<typeof contentEntrySchema>;
