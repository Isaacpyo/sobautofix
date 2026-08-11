import type { ContentSection } from "@/types/domain";

export const articleCtaPresets = [
  { id: "book", label: "Book an Appointment", heading: "Need help with your vehicle?", body: "Book an appointment with SOB Autofix.", buttonLabel: "Book an appointment", href: "/book" },
  { id: "quote", label: "Get a Quote", heading: "Need a clear next step?", body: "Send the vehicle details and what is happening for an informed response.", buttonLabel: "Get a quote", href: "/get-a-quote" },
  { id: "diagnostics", label: "Vehicle Diagnostics", heading: "Need help identifying a vehicle fault?", body: "Explore evidence-led vehicle diagnostics from SOB Autofix.", buttonLabel: "Explore diagnostics", href: "/diagnostics" },
  { id: "mobile", label: "Mobile Mechanic", heading: "Need help at your location?", body: "Tell us where the vehicle is and what is happening.", buttonLabel: "Request mobile assistance", href: "/mobile-mechanic" },
  { id: "contact", label: "Contact SOB Autofix", heading: "Want to discuss the next step?", body: "Contact SOB Autofix with the vehicle and problem details.", buttonLabel: "Contact SOB Autofix", href: "/contact" },
] as const;

export type ArticleCtaPreset = (typeof articleCtaPresets)[number]["id"];

export function slugifyArticleTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function normaliseArticleSlugInput(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "-and-")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 100);
}

export function defaultArticleSeoTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const value = trimmed.length < 10 ? `${trimmed} | SOB Autofix` : trimmed;
  return value.slice(0, 70).trim();
}

export function defaultArticleSeoDescription(excerpt: string) {
  return excerpt.trim().slice(0, 170).trim();
}

export function ctaSectionForPreset(id: ArticleCtaPreset): Extract<ContentSection, { type: "cta" }> {
  const preset = articleCtaPresets.find((item) => item.id === id) ?? articleCtaPresets[0];
  return { type: "cta", heading: preset.heading, body: preset.body, label: preset.buttonLabel, href: preset.href };
}

export function identifyCtaPreset(section: Extract<ContentSection, { type: "cta" }>) {
  return articleCtaPresets.find((item) => item.href === section.href && item.buttonLabel === section.label)?.id ?? "custom";
}
