"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ContentEntry, ContentSection } from "@/types/domain";
import { Button } from "@/components/ui/button";

const sectionTypes: Array<ContentSection["type"]> = ["hero", "richText", "vehicleLookup", "symptomSelector", "serviceCards", "process", "trustFacts", "offer", "reviews", "areas", "gallery", "faqs", "relatedLinks", "cta"];

export function ContentEditor({ entry, action }: { entry?: ContentEntry; action: (formData: FormData) => void | Promise<void> }) {
  const [sections, setSections] = useState<ContentSection[]>(entry?.sections || [{ type: "hero", eyebrow: "SOB Autofix", title: "", body: "", primaryCta: "vehicle-lookup" }]);
  function update(index: number, next: ContentSection) { setSections((current) => current.map((section, position) => position === index ? next : section)); }
  function add(type: ContentSection["type"]) { setSections((current) => [...current, blankSection(type)]); }
  function remove(index: number) { setSections((current) => current.filter((_, position) => position !== index)); }

  return <form action={action} className="grid gap-6"><input type="hidden" name="id" value={entry?.id || ""} /><input type="hidden" name="sections" value={JSON.stringify(sections)} /><input type="hidden" name="metadata" value={JSON.stringify(entry?.metadata || {})} />
    <div className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6 md:grid-cols-2"><AdminField label="Content type"><select name="kind" defaultValue={entry?.kind || "core_page"}><option value="core_page">Core page</option><option value="service">Service</option><option value="diagnostic">Diagnostic</option><option value="area">Area</option><option value="article">Article</option><option value="faq">FAQ collection</option></select></AdminField><AdminField label="Slug"><input name="slug" required pattern="[a-z0-9-]+" defaultValue={entry?.slug} placeholder="page-slug" /></AdminField><AdminField label="Title"><input name="title" required defaultValue={entry?.title} /></AdminField><AdminField label="Status"><select name="status" defaultValue={entry?.status || "draft"}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></AdminField><AdminField label="Scheduled publication time"><input name="publishedAt" type="datetime-local" defaultValue={entry?.status === "scheduled" && entry.publishedAt ? entry.publishedAt.slice(0, 16) : ""} /></AdminField><p className="self-end text-sm leading-6 text-[#667586]">Publishing is immediate. Scheduled entries remain private until a staff member changes their status to Published.</p><div className="md:col-span-2"><AdminField label="Excerpt"><textarea name="excerpt" required rows={3} defaultValue={entry?.excerpt} /></AdminField></div></div>
    <div><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold text-[#071127]">Structured sections</h2><p className="text-sm text-[#667586]">Every field is validated again when saved.</p></div><label className="flex items-center gap-2 rounded-lg border border-[#1974E2]/25 bg-white px-3 py-2 text-sm font-bold text-[#1974E2]"><Plus size={16} /><select className="bg-transparent outline-none" value="" onChange={(event) => { if (event.target.value) add(event.target.value as ContentSection["type"]); event.target.value = ""; }}><option value="">Add section…</option>{sectionTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div><div className="mt-5 grid gap-4">{sections.map((section, index) => <section key={`${section.type}-${index}`} className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><div className="mb-5 flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold text-[#071127]"><GripVertical size={18} className="text-[#9AA7B6]" />{section.type}</h3><button type="button" onClick={() => remove(index)} className="grid h-9 w-9 place-items-center rounded-lg text-red-700 hover:bg-red-50" aria-label={`Remove ${section.type} section`}><Trash2 size={17} /></button></div><SectionFields section={section} onChange={(next) => update(index, next)} /></section>)}</div></div>
    <div className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6"><h2 className="text-2xl font-bold text-[#071127]">Search appearance</h2><AdminField label="SEO title"><input name="seoTitle" required minLength={10} maxLength={70} defaultValue={entry?.seoTitle} /></AdminField><AdminField label="SEO description"><textarea name="seoDescription" required minLength={30} maxLength={170} rows={3} defaultValue={entry?.seoDescription} /></AdminField></div>
    <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-[#E4EAF0] bg-white/95 p-4 shadow-xl backdrop-blur">{entry && <Link href={`/admin/preview/${entry.id}`} target="_blank" className="min-h-11 rounded-xl border border-[#1974E2]/30 px-5 py-3 text-sm font-bold text-[#1974E2]">Preview</Link>}<Button type="submit">Save and validate</Button></div>
  </form>;
}

function SectionFields({ section, onChange }: { section: ContentSection; onChange: (section: ContentSection) => void }) {
  const input = (label: string, key: string, value: string | undefined, multiline = false) => <AdminField label={label}>{multiline ? <textarea rows={3} value={value || ""} onChange={(event) => onChange({ ...section, [key]: event.target.value } as ContentSection)} /> : <input value={value || ""} onChange={(event) => onChange({ ...section, [key]: event.target.value } as ContentSection)} />}</AdminField>;
  switch (section.type) {
    case "hero": return <div className="grid gap-4">{input("Eyebrow", "eyebrow", section.eyebrow)}{input("Title", "title", section.title)}{input("Body", "body", section.body, true)}<AdminField label="Primary interaction"><select value={section.primaryCta || ""} onChange={(event) => onChange({ ...section, primaryCta: event.target.value })}><option value="">None</option><option value="vehicle-lookup">Vehicle lookup</option></select></AdminField></div>;
    case "richText": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}<Lines label="Paragraphs (one per line)" value={section.paragraphs} onChange={(values) => onChange({ ...section, paragraphs: values })} /></div>;
    case "vehicleLookup": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}{input("Supporting text", "body", section.body, true)}</div>;
    case "symptomSelector": return input("Heading", "heading", section.heading);
    case "serviceCards": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}<Lines label="Service slugs (one per line)" value={section.slugs} onChange={(slugs) => onChange({ ...section, slugs })} /></div>;
    case "process": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}<Lines label="Steps (one per line)" value={section.steps} onChange={(steps) => onChange({ ...section, steps })} /></div>;
    case "trustFacts": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}<Pairs label="Facts: Title | description" value={section.facts.map((item) => `${item.title} | ${item.body}`)} onChange={(values) => onChange({ ...section, facts: values.map(splitPair).map(([title, body]) => ({ title, body })) })} /></div>;
    case "offer": return input("Offer ID", "offerId", section.offerId);
    case "reviews": case "areas": return input("Heading", "heading", section.heading);
    case "gallery": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}{input("Category", "category", section.category)}</div>;
    case "faqs": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}<Pairs label="Questions: Question | answer" value={section.items.map((item) => `${item.question} | ${item.answer}`)} onChange={(values) => onChange({ ...section, items: values.map(splitPair).map(([question, answer]) => ({ question, answer })) })} /></div>;
    case "relatedLinks": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}<Pairs label="Links: Label | /path" value={section.links.map((item) => `${item.label} | ${item.href}`)} onChange={(values) => onChange({ ...section, links: values.map(splitPair).map(([label, href]) => ({ label, href })) })} /></div>;
    case "cta": return <div className="grid gap-4">{input("Heading", "heading", section.heading)}{input("Body", "body", section.body, true)}{input("Button label", "label", section.label)}{input("Button path", "href", section.href)}</div>;
    default: return null;
  }
}

function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (values: string[]) => void }) { return <AdminField label={label}><textarea rows={5} value={value.join("\n")} onChange={(event) => onChange(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))} /></AdminField>; }
function Pairs(props: Parameters<typeof Lines>[0]) { return <Lines {...props} />; }
function splitPair(value: string): [string, string] { const [first, ...rest] = value.split("|"); return [first?.trim() || "", rest.join("|").trim()]; }

function blankSection(type: ContentSection["type"]): ContentSection {
  switch (type) {
    case "hero": return { type, eyebrow: "SOB Autofix", title: "", body: "" };
    case "richText": return { type, heading: "", paragraphs: [""] };
    case "vehicleLookup": return { type, heading: "Enter your registration", body: "" };
    case "symptomSelector": return { type, heading: "What is happening with your vehicle?" };
    case "serviceCards": return { type, heading: "Related services", slugs: ["car-diagnostics"] };
    case "process": return { type, heading: "How it works", steps: ["First step", "Next step"] };
    case "trustFacts": return { type, heading: "Why choose us", facts: [{ title: "Evidence-led", body: "Clear, professional testing." }] };
    case "offer": return { type, offerId: "" };
    case "reviews": return { type, heading: "Customer reviews" };
    case "areas": return { type, heading: "Areas covered" };
    case "gallery": return { type, heading: "Recent work" };
    case "faqs": return { type, heading: "Common questions", items: [{ question: "", answer: "" }] };
    case "relatedLinks": return { type, heading: "Related information", links: [{ label: "", href: "/" }] };
    case "cta": return { type, heading: "Ready to book?", body: "", label: "Book appointment", href: "/book" };
  }
}

export function AdminField({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="block text-sm font-bold text-[#071127]">{label}<span className="mt-2 block [&>input]:min-h-12 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-[#D7E0E9] [&>input]:px-4 [&>select]:min-h-12 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-[#D7E0E9] [&>select]:bg-white [&>select]:px-4 [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-[#D7E0E9] [&>textarea]:px-4 [&>textarea]:py-3">{children}</span></label>;
}
