"use client";

import { Bold, GripVertical, Italic, Link as LinkIcon, List, ListOrdered, Plus, Quote, Redo2, Trash2, Undo2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { diagnostics, services, siteConfig } from "@/config/site";
import { articleCategories, parseArticleMetadata } from "@/lib/news/article";
import { articleCtaPresets, ctaSectionForPreset, defaultArticleSeoDescription, defaultArticleSeoTitle, identifyCtaPreset, normaliseArticleSlugInput, slugifyArticleTitle, type ArticleCtaPreset } from "@/lib/news/editor";
import { articleMarkupToHtml, editorHtmlToArticleMarkup, sanitisePastedArticleHtml } from "@/lib/news/rich-text";
import type { ContentEntry, ContentSection } from "@/types/domain";

const sectionTypes: Array<ContentSection["type"]> = ["hero", "richText", "vehicleLookup", "symptomSelector", "serviceCards", "process", "trustFacts", "offer", "reviews", "areas", "gallery", "faqs", "relatedLinks", "cta"];
const articleSectionTypes: Array<ContentSection["type"]> = ["richText", "serviceCards", "gallery", "faqs", "relatedLinks", "cta"];

type MediaOption = { id: string; alt: string; category?: string; published: boolean; url?: string };
type CoverUploadAction = (formData: FormData) => Promise<{ error?: string; asset?: MediaOption }>;

export function ContentEditor({ entry, action, articleMode = false, media = [], coverUploadAction }: {
  entry?: ContentEntry;
  action: (formData: FormData) => void | Promise<void>;
  articleMode?: boolean;
  media?: MediaOption[];
  coverUploadAction?: CoverUploadAction;
}) {
  const initialArticle = parseArticleMetadata(entry?.metadata || {});
  const [articleMetadata, setArticleMetadata] = useState(initialArticle);
  const [sections, setSections] = useState<ContentSection[]>(entry?.sections || (articleMode
    ? [
        { type: "richText", heading: "", paragraphs: [""] },
        { type: "relatedLinks", heading: "Related information", links: [{ label: "Vehicle diagnostics", href: "/diagnostics" }] },
        { type: "cta", heading: "Need help with your vehicle?", body: "Book an appointment with SOB Autofix.", label: "Book appointment", href: "/book" },
      ]
    : [{ type: "hero", eyebrow: "SOB Autofix", title: "", body: "", primaryCta: "vehicle-lookup" }]));
  const availableSections = articleMode ? articleSectionTypes : sectionTypes;

  function update(index: number, next: ContentSection) {
    setSections((current) => current.map((section, position) => position === index ? next : section));
  }
  function add(type: ContentSection["type"]) { setSections((current) => [...current, blankSection(type)]); }
  function remove(index: number) { setSections((current) => current.filter((_, position) => position !== index)); }

  if (articleMode) return <ArticleEditor entry={entry} action={action} media={media} coverUploadAction={coverUploadAction} />;

  return <form action={action} className="grid gap-6">
    <input type="hidden" name="id" value={entry?.id || ""} />
    <input type="hidden" name="sections" value={JSON.stringify(sections)} />
    <input type="hidden" name="metadata" value={JSON.stringify(articleMode ? articleMetadata : entry?.metadata || {})} />
    <input type="hidden" name="returnTo" value={articleMode ? "news" : "content"} />
    {articleMode && <input type="hidden" name="kind" value="article" />}

    <div className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6 md:grid-cols-2">
      {!articleMode && <AdminField label="Content type"><select name="kind" defaultValue={entry?.kind || "core_page"}><option value="core_page">Core page</option><option value="service">Service</option><option value="diagnostic">Diagnostic</option><option value="area">Area</option><option value="faq">FAQ collection</option></select></AdminField>}
      <AdminField label="Slug"><input name="slug" required pattern="[a-z0-9-]+" defaultValue={entry?.slug} placeholder="article-slug" /></AdminField>
      <AdminField label="Title"><input name="title" required defaultValue={entry?.title} /></AdminField>
      <AdminField label="Status"><select name="status" defaultValue={entry?.status || "draft"}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></AdminField>
      <AdminField label="Scheduled publication time"><input name="publishedAt" type="datetime-local" defaultValue={entry?.status === "scheduled" && entry.publishedAt ? entry.publishedAt.slice(0, 16) : ""} /></AdminField>
      <p className="self-end text-sm leading-6 text-[#667586]">Scheduled entries remain private until their publication process changes them to Published.</p>
      <div className="md:col-span-2"><AdminField label="Excerpt"><textarea name="excerpt" required rows={3} defaultValue={entry?.excerpt} /></AdminField></div>
    </div>

    {articleMode && <div className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6 md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="text-2xl font-bold text-[#071127]">Article details</h2><p className="mt-1 text-sm text-[#667586]">The canonical public URL will be /news/{entry?.slug || "article-slug"}.</p></div>
      <AdminField label="Category"><select value={articleMetadata.category} onChange={(event) => setArticleMetadata((current) => ({ ...current, category: event.target.value as typeof current.category }))}>{articleCategories.map((category) => <option key={category}>{category}</option>)}</select></AdminField>
      <AdminField label="Author"><input value={articleMetadata.author} onChange={(event) => setArticleMetadata((current) => ({ ...current, author: event.target.value }))} /></AdminField>
      <AdminField label="Cover image"><select value={articleMetadata.coverImageId || ""} onChange={(event) => setArticleMetadata((current) => ({ ...current, coverImageId: event.target.value || undefined }))}><option value="">No cover image</option>{media.map((item) => <option key={item.id} value={item.id}>{item.published ? "Published" : "Draft"} · {item.alt}{item.category ? ` (${item.category})` : ""}</option>)}</select></AdminField>
      <label className="flex items-center gap-3 self-end rounded-xl border border-[#D7E0E9] px-4 py-3 text-sm font-bold text-[#071127]"><input type="checkbox" checked={articleMetadata.featured || false} onChange={(event) => setArticleMetadata((current) => ({ ...current, featured: event.target.checked }))} />Feature this article on the News page</label>
    </div>}

    <div>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold text-[#071127]">Structured sections</h2><p className="text-sm text-[#667586]">Every field is validated again when saved.</p></div><label className="flex items-center gap-2 rounded-lg border border-[#1974E2]/25 bg-white px-3 py-2 text-sm font-bold text-[#1974E2]"><Plus size={16} /><select className="bg-transparent outline-none" value="" onChange={(event) => { if (event.target.value) add(event.target.value as ContentSection["type"]); event.target.value = ""; }}><option value="">Add section…</option>{availableSections.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div>
      <div className="mt-5 grid gap-4">{sections.map((section, index) => <section key={`${section.type}-${index}`} className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><div className="mb-5 flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold text-[#071127]"><GripVertical size={18} className="text-[#9AA7B6]" />{section.type}</h3><button type="button" onClick={() => remove(index)} className="grid h-9 w-9 place-items-center rounded-lg text-red-700 hover:bg-red-50" aria-label={`Remove ${section.type} section`}><Trash2 size={17} /></button></div><SectionFields section={section} onChange={(next) => update(index, next)} /></section>)}</div>
    </div>

    <div className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-6"><h2 className="text-2xl font-bold text-[#071127]">Search appearance</h2><AdminField label="SEO title"><input name="seoTitle" required minLength={10} maxLength={70} defaultValue={entry?.seoTitle} /></AdminField><AdminField label="SEO description"><textarea name="seoDescription" required minLength={30} maxLength={170} rows={3} defaultValue={entry?.seoDescription} /></AdminField></div>

    <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-[#E4EAF0] bg-white/95 p-4 shadow-xl backdrop-blur">
      {entry && <Link href={`/admin/preview/${entry.id}`} target="_blank" className="min-h-11 rounded-xl border border-[#1974E2]/30 px-5 py-3 text-sm font-bold text-[#1974E2]">Preview</Link>}
      {articleMode && <Button type="submit" name="articleIntent" value="draft" variant="outline">Save draft</Button>}
      {articleMode && <Button type="submit" variant="outline">Save changes</Button>}
      {articleMode && entry?.status === "published" && <Button type="submit" name="articleIntent" value="archived" variant="outline">Archive</Button>}
      <Button type="submit" name={articleMode ? "articleIntent" : undefined} value={articleMode ? "published" : undefined}>{articleMode ? "Publish" : "Save and validate"}</Button>
    </div>
  </form>;
}

const serviceOptions = [...diagnostics, ...services]
  .filter((item) => item.published)
  .map((item) => ({ label: item.name, value: item.slug }));

const internalLinkOptions = [
  { label: "Vehicle Diagnostics", value: "/diagnostics" },
  { label: "Engine Management Light", value: "/diagnostics/engine-management-light" },
  { label: "Electrical Fault Finding", value: "/diagnostics/electrical-fault-finding" },
  { label: "Battery & Charging Diagnostics", value: "/diagnostics/battery-charging" },
  { label: "Vehicle Servicing", value: "/services/vehicle-servicing" },
  { label: "Mobile Mechanic", value: "/mobile-mechanic" },
  { label: "Vehicle Inspections", value: "/vehicle-inspections" },
  { label: "Book an Appointment", value: "/book" },
  { label: "Get a Quote", value: "/get-a-quote" },
  { label: "Contact SOB Autofix", value: "/contact" },
];

const articleBlockOptions = [
  { type: "richText", label: "Text section" },
  { type: "serviceCards", label: "Related services" },
  { type: "gallery", label: "Image gallery" },
  { type: "faqs", label: "FAQs" },
  { type: "relatedLinks", label: "Related links" },
  { type: "cta", label: "Call to action" },
] as const;

function ArticleEditor({ entry, action, media, coverUploadAction }: { entry?: ContentEntry; action: (formData: FormData) => void | Promise<void>; media: MediaOption[]; coverUploadAction?: CoverUploadAction }) {
  const initialArticle = parseArticleMetadata(entry?.metadata || {});
  const [title, setTitle] = useState(entry?.title || "");
  const [excerpt, setExcerpt] = useState(entry?.excerpt || "");
  const [slug, setSlug] = useState(entry?.slug || "");
  const [slugEdited, setSlugEdited] = useState(Boolean(entry));
  const [category, setCategory] = useState(initialArticle.category);
  const [author, setAuthor] = useState(initialArticle.author || "SOB Autofix Team");
  const [coverImageId, setCoverImageId] = useState(initialArticle.coverImageId || "");
  const [availableMedia, setAvailableMedia] = useState(media);
  const [featured, setFeatured] = useState(initialArticle.featured || false);
  const [status, setStatus] = useState(entry?.status || "draft");
  const [seoTitleOverride, setSeoTitleOverride] = useState(entry && entry.seoTitle !== defaultArticleSeoTitle(entry.title) ? entry.seoTitle : "");
  const [seoDescriptionOverride, setSeoDescriptionOverride] = useState(entry && entry.seoDescription !== defaultArticleSeoDescription(entry.excerpt) ? entry.seoDescription : "");
  const [sections, setSections] = useState<ContentSection[]>(entry?.sections?.length ? entry.sections : [{ type: "richText", paragraphs: [""] }]);
  const generatedSeoTitle = seoTitleOverride.trim() || defaultArticleSeoTitle(title);
  const generatedSeoDescription = seoDescriptionOverride.trim() || defaultArticleSeoDescription(excerpt);
  const publishedSlugChanged = entry?.status === "published" && slug !== entry.slug;
  const metadata = { category, author: author.trim() || "SOB Autofix Team", coverImageId: coverImageId || undefined, featured };

  function changeTitle(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(slugifyArticleTitle(value));
  }

  function updateSection(index: number, next: ContentSection) {
    setSections((current) => current.map((section, position) => position === index ? next : section));
  }

  function removeSection(index: number) {
    setSections((current) => current.filter((_, position) => position !== index));
  }

  function addArticleBlock(type: typeof articleBlockOptions[number]["type"]) {
    const next = type === "richText" ? { type, heading: "", paragraphs: [""] } as ContentSection
      : type === "serviceCards" ? { type, heading: "Related services", slugs: [] } as ContentSection
        : type === "gallery" ? { type, heading: "Article images", mediaIds: [] } as ContentSection
          : type === "faqs" ? { type, heading: "Common questions", items: [{ question: "", answer: "" }] } as ContentSection
            : type === "relatedLinks" ? { type, heading: "Related information", links: [{ label: "", href: "/diagnostics" }] } as ContentSection
              : ctaSectionForPreset("book");
    setSections((current) => [...current, next]);
  }

  return (
    <form action={action} className="grid gap-7" data-testid="simplified-article-editor">
      <input type="hidden" name="id" value={entry?.id || ""} />
      <input type="hidden" name="kind" value="article" />
      <input type="hidden" name="returnTo" value="news" />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />
      <input type="hidden" name="metadata" value={JSON.stringify(metadata)} />
      <input type="hidden" name="seoTitle" value={generatedSeoTitle} />
      <input type="hidden" name="seoDescription" value={generatedSeoDescription} />

      <section className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="article-essentials-heading">
        <h2 id="article-essentials-heading" className="sr-only">Article essentials</h2>
        <AdminField label="Title"><input name="title" required minLength={3} maxLength={140} value={title} onChange={(event) => changeTitle(event.target.value)} autoFocus /></AdminField>
        <AdminField label="Article URL"><div className="overflow-hidden rounded-xl border border-[#D7E0E9] bg-white focus-within:border-[#1974E2] sm:flex sm:items-center"><span className="block shrink-0 bg-[#F4F7FA] px-4 py-3 text-sm text-[#586575] sm:border-r sm:border-[#D7E0E9]">{siteConfig.siteUrl.replace(/\/$/, "")}/news/</span><input aria-label="Article URL" className="min-h-12 min-w-0 flex-1 border-0 px-4 outline-none" value={slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => { setSlugEdited(true); setSlug(normaliseArticleSlugInput(event.target.value)); }} /></div></AdminField>
        <div className="-mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-[#667586]">Lowercase letters, numbers and hyphens only.</span>{slugEdited && <button type="button" className="font-bold text-[#1974E2]" onClick={() => { setSlugEdited(false); setSlug(slugifyArticleTitle(title)); }}>Reset from title</button>}</div>
        {publishedSlugChanged && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"><input className="mt-1" type="checkbox" required />Changing the article URL may affect existing links and search rankings. I understand and want to save this change.</label>}
        <AdminField label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{articleCategories.map((item) => <option key={item}>{item}</option>)}</select></AdminField>
        <CoverImageField media={availableMedia} selectedId={coverImageId} onSelect={setCoverImageId} uploadAction={coverUploadAction} onUploaded={(asset) => { setAvailableMedia((current) => [asset, ...current]); setCoverImageId(asset.id); }} />
        <AdminField label="Excerpt"><textarea name="excerpt" required minLength={30} maxLength={170} rows={3} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} aria-describedby="article-excerpt-help" /></AdminField>
        <p id="article-excerpt-help" className="-mt-3 text-sm text-[#667586]">A short summary shown on the News page and in search previews.</p>
      </section>

      <section aria-labelledby="article-content-heading">
        <div>
          <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Writing</p>
          <h2 id="article-content-heading" className="mt-2 text-3xl font-extrabold text-[#071127]">Article content</h2>
          <p className="mt-2 text-sm text-[#667586]">Use the toolbar for headings, emphasis, lists, links and quotes. Images remain safely managed through the Media Library.</p>
        </div>
        <div className="mt-5 grid gap-4">
          {sections.map((section, index) => (
            <ArticleSectionEditor
              key={`${section.type}-${index}`}
              section={section}
              primary={section.type === "richText" && index === sections.findIndex((item) => item.type === "richText")}
              media={availableMedia}
              onChange={(next) => updateSection(index, next)}
              onRemove={() => removeSection(index)}
            />
          ))}
        </div>
        <label className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1974E2]/25 bg-white px-4 text-sm font-bold text-[#1974E2]">
          <Plus size={16} aria-hidden="true" /> Add content block
          <select aria-label="Add content block" className="bg-transparent outline-none" value="" onChange={(event) => { if (event.target.value) addArticleBlock(event.target.value as typeof articleBlockOptions[number]["type"]); event.target.value = ""; }}>
            <option value="">Choose block…</option>
            {articleBlockOptions.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-5 rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="article-publishing-heading">
        <div><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Publishing</p><h2 id="article-publishing-heading" className="mt-2 text-2xl font-bold text-[#071127]">Publishing</h2></div>
        <div className="grid gap-5 md:grid-cols-2 md:items-end">
          <AdminField label="Status"><select name="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option>{entry?.status === "archived" && <option value="archived">Archived</option>}</select></AdminField>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#D7E0E9] px-4 text-sm font-bold text-[#071127]"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />Feature this article</label>
        </div>
        {status === "scheduled" && <AdminField label="Publish date and time"><input name="publishedAt" type="datetime-local" required defaultValue={entry?.status === "scheduled" && entry.publishedAt ? entry.publishedAt.slice(0, 16) : ""} /></AdminField>}
        {status === "scheduled" && <p className="text-sm text-[#667586]">Scheduled articles remain private until their publish time.</p>}

        <details className="rounded-xl border border-[#D7E0E9] bg-[#F8FAFC] p-4">
          <summary className="cursor-pointer font-bold text-[#071127]">Advanced settings</summary>
          <div className="mt-5 grid gap-5">
            <AdminField label="Author"><input value={author} minLength={2} maxLength={100} onChange={(event) => setAuthor(event.target.value)} /></AdminField>
            <AdminField label="SEO title override"><input value={seoTitleOverride} maxLength={70} placeholder={defaultArticleSeoTitle(title)} onChange={(event) => setSeoTitleOverride(event.target.value)} /></AdminField>
            <AdminField label="SEO description override"><textarea rows={3} value={seoDescriptionOverride} maxLength={170} placeholder={defaultArticleSeoDescription(excerpt)} onChange={(event) => setSeoDescriptionOverride(event.target.value)} /></AdminField>
          </div>
        </details>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-[#E4EAF0] bg-white/95 p-4 shadow-xl backdrop-blur">
        {entry && <Link href={`/admin/preview/${entry.id}`} target="_blank" className="min-h-12 rounded-lg border border-[#1974E2]/30 px-5 py-3 text-sm font-bold text-[#1974E2]">Preview</Link>}
        {status !== "published" && <Button type="submit" name="articleIntent" value="draft" variant="outline">Save draft</Button>}
        {entry?.status === "published" && <Button type="submit" name="articleIntent" value="archived" variant="outline">Archive</Button>}
        {status === "draft" && <Button type="submit" name="articleIntent" value="published">Publish</Button>}
        {status === "scheduled" && <Button type="submit">Schedule article</Button>}
        {status === "published" && <Button type="submit" name="articleIntent" value="published">{entry ? "Save changes" : "Publish"}</Button>}
        {status === "archived" && <Button type="submit" name="articleIntent" value="draft">Restore as draft</Button>}
      </div>
    </form>
  );
}

function ArticleSectionEditor({ section, primary, media, onChange, onRemove }: { section: ContentSection; primary: boolean; media: MediaOption[]; onChange: (section: ContentSection) => void; onRemove: () => void }) {
  const label = primary && section.type === "richText" ? "Article content" : articleBlockOptions.find((item) => item.type === section.type)?.label || "Content block";
  return (
    <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4"><h3 className="text-lg font-bold text-[#071127]">{label}</h3>{!primary && <button type="button" onClick={onRemove} className="grid size-10 place-items-center rounded-lg text-red-700 hover:bg-red-50" aria-label={`Remove ${label}`}><Trash2 size={17} /></button>}</div>
      {section.type === "richText" && <div className="grid gap-4">{(!primary || section.heading) && <AdminField label="Section heading"><input value={section.heading || ""} onChange={(event) => onChange({ ...section, heading: event.target.value })} /></AdminField>}<ArticleBodyField value={section.paragraphs.join("\n\n")} onChange={(value) => onChange({ ...section, paragraphs: [value] })} /></div>}
      {section.type === "serviceCards" && <RelatedServicesField section={section} onChange={onChange} />}
      {section.type === "gallery" && <GalleryField section={section} media={media} onChange={onChange} />}
      {section.type === "faqs" && <FaqField section={section} onChange={onChange} />}
      {section.type === "relatedLinks" && <RelatedLinksField section={section} onChange={onChange} />}
      {section.type === "cta" && <CtaField section={section} onChange={onChange} onRemove={onRemove} />}
      {!articleBlockOptions.some((item) => item.type === section.type) && <SectionFields section={section} onChange={onChange} />}
    </section>
  );
}

function CoverImageField({ media, selectedId, onSelect, uploadAction, onUploaded }: { media: MediaOption[]; selectedId: string; onSelect: (id: string) => void; uploadAction?: CoverUploadAction; onUploaded: (asset: MediaOption) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [alt, setAlt] = useState("");
  const [localPreview, setLocalPreview] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const selected = media.find((item) => item.id === selectedId);

  useEffect(() => () => { if (localPreview.startsWith("blob:")) URL.revokeObjectURL(localPreview); }, [localPreview]);

  function chooseFile(next?: File) {
    setError("");
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("Please upload a JPG, PNG or WebP image."); return; }
    if (next.size > 8 * 1024 * 1024) { setError("This image is too large. Please choose an image under 8 MB."); return; }
    setFile(next);
    if (localPreview.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    setLocalPreview(typeof URL.createObjectURL === "function" ? URL.createObjectURL(next) : "");
  }

  async function upload() {
    if (!file) { setError("Choose an image to upload."); fileInput.current?.click(); return; }
    if (alt.trim().length < 5) { setError("Add useful alt text of at least five characters."); return; }
    if (!uploadAction) { setError("Cover uploads are temporarily unavailable. Choose an image from the Media Library."); return; }
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt", alt);
    const result = await uploadAction(formData);
    setUploading(false);
    if (result.error || !result.asset) { setError(result.error || "The image could not be uploaded. Please try again."); return; }
    onUploaded(result.asset);
    setFile(undefined);
    setLocalPreview("");
    setAlt("");
    if (fileInput.current) fileInput.current.value = "";
  }

  const preview = localPreview || selected?.url;
  const previewAlt = localPreview ? alt || "Selected cover image preview" : selected?.alt || "";
  return <fieldset className="grid gap-4"><legend className="text-sm font-bold text-[#071127]">Cover image</legend><div className="grid gap-4 rounded-2xl border border-dashed border-[#B8C7D9] bg-[#F8FAFC] p-4 sm:p-5"><div className="relative grid min-h-48 place-items-center overflow-hidden rounded-xl bg-[#E8EEF4]">{preview ? <Image src={preview} alt={previewAlt} fill unoptimized={preview.startsWith("blob:")} sizes="(max-width: 768px) 100vw, 720px" className="object-contain" /> : <div className="px-4 text-center"><Upload className="mx-auto text-[#1974E2]" aria-hidden="true" /><p className="mt-3 font-bold text-[#071127]">No cover image selected</p><p className="mt-1 text-sm text-[#667586]">Upload a new image or choose one from the Media Library.</p></div>}</div><div className="flex flex-wrap items-center gap-3"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[#1974E2] px-4 text-sm font-bold text-white"><Upload size={16} aria-hidden="true" /><span>{file ? "Change file" : "Upload file"}</span><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} /></label><label className="min-w-52 flex-1"><span className="sr-only">Choose from Media Library</span><select aria-label="Choose from Media Library" className="min-h-11 w-full rounded-lg border border-[#D7E0E9] bg-white px-3 text-sm font-semibold" value={selectedId} onChange={(event) => { onSelect(event.target.value); setFile(undefined); setLocalPreview(""); setError(""); }}><option value="">Choose from library…</option>{media.map((item) => <option key={item.id} value={item.id}>{item.alt}{item.category ? ` · ${item.category}` : ""}{item.published ? "" : " · Draft"}</option>)}</select></label>{selectedId && <button type="button" onClick={() => onSelect("")} className="min-h-11 rounded-lg px-3 text-sm font-bold text-red-700">Remove</button>}</div>{file && <div className="grid gap-3 rounded-xl bg-white p-4"><AdminField label="Alt text"><input value={alt} minLength={5} maxLength={180} onChange={(event) => setAlt(event.target.value)} aria-describedby="cover-alt-help" /></AdminField><p id="cover-alt-help" className="text-sm text-[#667586]">Briefly describe the image for visitors using screen readers.</p><button type="button" disabled={uploading} onClick={upload} className="min-h-11 justify-self-start rounded-lg bg-[#071127] px-4 text-sm font-bold text-white disabled:opacity-60">{uploading ? "Uploading…" : "Upload and use"}</button></div>}{selected && !selected.published && <p className="text-sm font-semibold text-amber-800">This image is saved as a draft. Publish it in the Media Library before publishing the article.</p>}{error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error} <button type="button" className="underline" onClick={() => fileInput.current?.click()}>Try another file</button></p>}</div></fieldset>;
}

function ArticleBodyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const [initialHtml] = useState(() => articleMarkupToHtml(value));
  const savedRange = useRef<Range | undefined>(undefined);
  const linkInput = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("/diagnostics");
  const [format, setFormat] = useState("p");
  const [empty, setEmpty] = useState(!value.trim());
  const [active, setActive] = useState({ bold: false, italic: false, bullets: false, numbered: false, quote: false });

  useEffect(() => {
    function updateFormatting() {
      if (!editor.current || typeof document.queryCommandState !== "function") return;
      const selection = window.getSelection();
      if (!selection?.anchorNode || !editor.current.contains(selection.anchorNode)) return;
      if (selection.rangeCount) savedRange.current = selection.getRangeAt(0).cloneRange();
      const block = typeof document.queryCommandValue === "function" ? String(document.queryCommandValue("formatBlock")).toLowerCase().replace(/[<>]/g, "") : "";
      if (["p", "h2", "h3"].includes(block)) setFormat(block);
      setActive({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), bullets: document.queryCommandState("insertUnorderedList"), numbered: document.queryCommandState("insertOrderedList"), quote: block === "blockquote" });
    }
    document.addEventListener("selectionchange", updateFormatting);
    return () => document.removeEventListener("selectionchange", updateFormatting);
  }, []);

  useLayoutEffect(() => { if (editor.current) editor.current.innerHTML = initialHtml; }, [initialHtml]);

  useEffect(() => { if (linkOpen) linkInput.current?.focus(); }, [linkOpen]);

  function sync() { if (editor.current) { const next = editorHtmlToArticleMarkup(editor.current.innerHTML); setEmpty(!next.trim()); onChange(next); } }
  function command(name: string, argument?: string) {
    editor.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRange.current) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
    if (typeof document.execCommand === "function") document.execCommand(name, false, argument);
    sync();
  }
  function changeBlock(next: string) { setFormat(next); command("formatBlock", `<${next}>`); }
  function openLink() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
      setLinkText(selection.toString());
    }
    setLinkOpen(true);
  }
  function applyLink() {
    const href = linkUrl.trim();
    if (!/^(?:\/[^\s]*|https?:\/\/[^\s]+)$/i.test(href) || !linkText.trim()) return;
    const selection = window.getSelection();
    if (selection && savedRange.current) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
    editor.current?.focus();
    if (typeof document.execCommand === "function") {
      if (selection && !selection.isCollapsed && selection.toString() === linkText) document.execCommand("createLink", false, href);
      else document.execCommand("insertHTML", false, `<a href="${href.replaceAll('"', "&quot;")}">${linkText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</a>`);
    }
    sync();
    setLinkOpen(false);
    editor.current?.focus();
  }
  function paste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const safe = html ? sanitisePastedArticleHtml(html) : text.split(/\r?\n/).filter(Boolean).map((line) => `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`).join("");
    if (typeof document.execCommand === "function") document.execCommand("insertHTML", false, safe);
    sync();
  }

  // @ts-expect-error The focusable list is checked for an empty result before its first and last items are used.
  return <div className="max-w-4xl"><div className="flex max-w-full flex-wrap gap-1 overflow-x-auto rounded-t-xl border border-b-0 border-[#D7E0E9] bg-[#F8FAFC] p-2" role="toolbar" aria-label="Article formatting toolbar"><label className="sr-only" htmlFor="article-block-format">Text style</label><select id="article-block-format" aria-label="Text style" value={format} onChange={(event) => changeBlock(event.target.value)} className="min-h-10 rounded-lg border border-[#D7E0E9] bg-white px-3 text-sm font-bold"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select><ToolbarButton label="Bold" active={active.bold} onClick={() => command("bold")} icon={<Bold size={16} />} /><ToolbarButton label="Italic" active={active.italic} onClick={() => command("italic")} icon={<Italic size={16} />} /><ToolbarButton label="Bulleted list" active={active.bullets} onClick={() => command("insertUnorderedList")} icon={<List size={16} />} /><ToolbarButton label="Numbered list" active={active.numbered} onClick={() => command("insertOrderedList")} icon={<ListOrdered size={16} />} /><ToolbarButton label="Link" onClick={openLink} icon={<LinkIcon size={16} />} /><ToolbarButton label="Block quote" active={active.quote} onClick={() => command("formatBlock", "<blockquote>")} icon={<Quote size={16} />} /><ToolbarButton label="Undo" onClick={() => command("undo")} icon={<Undo2 size={16} />} /><ToolbarButton label="Redo" onClick={() => command("redo")} icon={<Redo2 size={16} />} /></div><div className="relative"><div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-label="Article content" aria-multiline="true" onInput={sync} onPaste={paste} className="min-h-[420px] w-full rounded-b-xl border border-[#D7E0E9] bg-white px-5 py-5 text-base leading-8 text-[#263445] outline-none focus:border-[#1974E2] [&_a]:font-semibold [&_a]:text-[#1974E2] [&_a]:underline [&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-[#1974E2] [&_blockquote]:bg-[#F4F7FA] [&_blockquote]:px-5 [&_blockquote]:py-3 [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-3xl [&_h2]:font-extrabold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-bold [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-7 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-7" />{empty && <span aria-hidden="true" className="pointer-events-none absolute left-5 top-5 text-[#8794A3]">Start writing your article...</span>}</div>{linkOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-[#071127]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="article-link-title" onKeyDown={(event) => { if (event.key === "Escape") { setLinkOpen(false); editor.current?.focus(); } if (event.key === "Tab") { const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('input,button,[href],[tabindex]:not([tabindex="-1"])')].filter((item) => !item.hasAttribute("disabled")); if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 id="article-link-title" className="text-xl font-bold text-[#071127]">Add link</h3><div className="mt-5 grid gap-4"><AdminField label="Link text"><input ref={linkInput} value={linkText} onChange={(event) => setLinkText(event.target.value)} /></AdminField><AdminField label="URL"><input list="article-link-destinations" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="/diagnostics or https://…" /></AdminField><datalist id="article-link-destinations">{internalLinkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist><div className="flex justify-end gap-3"><button type="button" className="min-h-11 rounded-lg px-4 font-bold text-[#586575]" onClick={() => { setLinkOpen(false); editor.current?.focus(); }}>Cancel</button><button type="button" className="min-h-11 rounded-lg bg-[#1974E2] px-4 font-bold text-white" onClick={applyLink}>Add link</button></div></div></div></div>}</div>;
}

function ToolbarButton({ label, onClick, icon, active = false }: { label: string; onClick: () => void; icon: React.ReactNode; active?: boolean }) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} aria-label={label} aria-pressed={active} title={label} className={`grid min-h-10 min-w-10 place-items-center rounded-lg px-3 text-xs font-bold shadow-sm ${active ? "bg-[#1974E2] text-white" : "bg-white text-[#334155] hover:text-[#1974E2]"}`}>{icon}<span className="sr-only">{label}</span></button>;
}

function RelatedServicesField({ section, onChange }: { section: Extract<ContentSection, { type: "serviceCards" }>; onChange: (section: ContentSection) => void }) {
  return <div><select aria-label="Add related service" className="min-h-12 w-full rounded-xl border border-[#D7E0E9] bg-white px-4" value="" onChange={(event) => { if (event.target.value && !section.slugs.includes(event.target.value)) onChange({ ...section, slugs: [...section.slugs, event.target.value] }); event.target.value = ""; }}><option value="">Choose a service…</option>{serviceOptions.filter((item) => !section.slugs.includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><div className="mt-3 flex flex-wrap gap-2">{section.slugs.map((slug) => <button key={slug} type="button" onClick={() => onChange({ ...section, slugs: section.slugs.filter((item) => item !== slug) })} className="rounded-full bg-[#EAF3FF] px-3 py-2 text-sm font-bold text-[#1446A5]">{serviceOptions.find((item) => item.value === slug)?.label || slug} ×</button>)}</div></div>;
}

function GalleryField({ section, media, onChange }: { section: Extract<ContentSection, { type: "gallery" }>; media: MediaOption[]; onChange: (section: ContentSection) => void }) {
  const selected = section.mediaIds || [];
  return <div className="grid gap-2">{media.length ? media.map((item) => <label key={item.id} className="flex items-start gap-3 rounded-xl border border-[#D7E0E9] p-3 text-sm"><input className="mt-1" type="checkbox" checked={selected.includes(item.id)} onChange={(event) => onChange({ ...section, mediaIds: event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id) })} /><span><strong className="block text-[#071127]">{item.alt}</strong><span className="text-[#667586]">{item.category || "General"}{item.published ? "" : " · Draft image"}</span></span></label>) : <p className="text-sm text-[#667586]">No Media Library images are available yet.</p>}</div>;
}

function FaqField({ section, onChange }: { section: Extract<ContentSection, { type: "faqs" }>; onChange: (section: ContentSection) => void }) {
  return <div className="grid gap-4">{section.items.map((item, index) => <div key={index} className="grid gap-3 rounded-xl bg-[#F8FAFC] p-4"><AdminField label="Question"><input value={item.question} onChange={(event) => onChange({ ...section, items: section.items.map((current, position) => position === index ? { ...current, question: event.target.value } : current) })} /></AdminField><AdminField label="Answer"><textarea rows={3} value={item.answer} onChange={(event) => onChange({ ...section, items: section.items.map((current, position) => position === index ? { ...current, answer: event.target.value } : current) })} /></AdminField>{section.items.length > 1 && <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, position) => position !== index) })} className="justify-self-start text-sm font-bold text-red-700">Remove question</button>}</div>)}<button type="button" onClick={() => onChange({ ...section, items: [...section.items, { question: "", answer: "" }] })} className="justify-self-start text-sm font-bold text-[#1974E2]">+ Add question</button></div>;
}

function RelatedLinksField({ section, onChange }: { section: Extract<ContentSection, { type: "relatedLinks" }>; onChange: (section: ContentSection) => void }) {
  return <div className="grid gap-4">{section.links.map((link, index) => { const known = internalLinkOptions.some((option) => option.value === link.href); return <div key={index} className="grid gap-3 rounded-xl bg-[#F8FAFC] p-4 md:grid-cols-2"><AdminField label="Link text"><input value={link.label} onChange={(event) => onChange({ ...section, links: section.links.map((current, position) => position === index ? { ...current, label: event.target.value } : current) })} /></AdminField><AdminField label="Destination"><select value={known ? link.href : "custom"} onChange={(event) => onChange({ ...section, links: section.links.map((current, position) => position === index ? { ...current, href: event.target.value === "custom" ? "/" : event.target.value } : current) })}>{internalLinkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom internal page</option></select></AdminField>{!known && <div className="md:col-span-2"><AdminField label="Custom path"><input value={link.href} pattern="/.*" onChange={(event) => onChange({ ...section, links: section.links.map((current, position) => position === index ? { ...current, href: event.target.value } : current) })} /></AdminField></div>}{section.links.length > 1 && <button type="button" onClick={() => onChange({ ...section, links: section.links.filter((_, position) => position !== index) })} className="justify-self-start text-sm font-bold text-red-700">Remove link</button>}</div>; })}<button type="button" onClick={() => onChange({ ...section, links: [...section.links, { label: "", href: "/diagnostics" }] })} className="justify-self-start text-sm font-bold text-[#1974E2]">+ Add link</button></div>;
}

function CtaField({ section, onChange, onRemove }: { section: Extract<ContentSection, { type: "cta" }>; onChange: (section: ContentSection) => void; onRemove: () => void }) {
  const selected = identifyCtaPreset(section);
  return <div className="grid gap-4"><AdminField label="Call to action"><select value={selected} onChange={(event) => { if (event.target.value === "none") onRemove(); else if (event.target.value === "custom") onChange({ type: "cta", heading: "", body: "", label: "", href: "/" }); else onChange(ctaSectionForPreset(event.target.value as ArticleCtaPreset)); }}><option value="none">None</option>{articleCtaPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}<option value="custom">Custom</option></select></AdminField>{selected === "custom" && <div className="grid gap-4 rounded-xl bg-[#F8FAFC] p-4"><AdminField label="Heading"><input value={section.heading} onChange={(event) => onChange({ ...section, heading: event.target.value })} /></AdminField><AdminField label="Supporting text"><textarea rows={3} value={section.body} onChange={(event) => onChange({ ...section, body: event.target.value })} /></AdminField><AdminField label="Button label"><input value={section.label} onChange={(event) => onChange({ ...section, label: event.target.value })} /></AdminField><AdminField label="Button path"><input value={section.href} pattern="/.*" onChange={(event) => onChange({ ...section, href: event.target.value })} /></AdminField></div>}</div>;
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
