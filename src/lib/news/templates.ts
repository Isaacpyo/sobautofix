import type { ContentEntry } from "@/types/domain";

export const automotiveAdviceArticleTemplate: ContentEntry = {
  id: "",
  kind: "article",
  slug: "",
  title: "",
  excerpt: "",
  sections: [
    { type: "richText", heading: "Introduction", paragraphs: [""] },
    { type: "richText", heading: "What drivers should know", paragraphs: [""] },
    { type: "faqs", heading: "Common questions", items: [{ question: "", answer: "" }] },
    { type: "relatedLinks", heading: "Related information", links: [{ label: "Vehicle diagnostics", href: "/diagnostics" }] },
    { type: "cta", heading: "Need help with your vehicle?", body: "Book an appointment with SOB Autofix.", label: "Book an appointment", href: "/book" },
  ],
  metadata: { category: "Advice & Guides", author: "SOB Autofix Team", featured: false },
  seoTitle: "",
  seoDescription: "",
  status: "draft",
  updatedAt: "",
};
