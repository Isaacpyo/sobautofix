// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContentEditor } from "@/components/admin/content-editor";
import { automotiveAdviceArticleTemplate } from "@/lib/news/templates";

const action = vi.fn(async () => undefined);
const media = [
  { id: "11111111-1111-4111-8111-111111111111", alt: "Technician testing a vehicle", category: "news", published: true },
  { id: "22222222-2222-4222-8222-222222222222", alt: "Workshop image awaiting approval", category: "news", published: false },
];

describe("simplified News article editor", () => {
  it("starts a reusable template as a new draft with automatic URL generation", () => {
    const { container } = render(<ContentEditor articleMode entry={automotiveAdviceArticleTemplate} action={action} media={media} />);
    const sections = container.querySelector<HTMLInputElement>('input[name="sections"]');
    expect(sections).not.toBeNull();
    expect(JSON.parse(sections!.value).map((section: { type: string }) => section.type)).toEqual(["richText", "richText", "faqs", "relatedLinks", "cta"]);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to Look After Your Brakes" } });
    expect(screen.getByLabelText("Article URL")).toHaveValue("how-to-look-after-your-brakes");
    expect(screen.getByLabelText("Status")).toHaveValue("draft");
  });

  it("starts with essential fields and no automatic optional blocks", () => {
    render(<ContentEditor articleMode action={action} media={media} />);
    expect(screen.getByLabelText("Title")).toBeVisible();
    expect(screen.getByLabelText("Category")).toBeVisible();
    expect(screen.getByText("Cover image")).toBeVisible();
    expect(screen.getByText("Upload file")).toBeVisible();
    expect(screen.getByLabelText("Excerpt")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Article content" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Status")).toHaveValue("draft");
    expect(screen.queryByText("Structured sections")).not.toBeInTheDocument();
    expect(screen.queryByText("Related information")).not.toBeInTheDocument();
    expect(screen.queryByText("Need help with your vehicle?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status").querySelector('option[value="archived"]')).toBeNull();
  });

  it("generates the slug and SEO defaults from title and excerpt", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContentEditor articleMode action={action} media={media} />);
    await user.type(screen.getByLabelText("Title"), "How to Understand Your Engine Management Light");
    await user.type(screen.getByLabelText("Excerpt"), "A clear guide to understanding an engine management warning light.");
    expect(container.querySelector<HTMLInputElement>('input[name="slug"]')).toHaveValue("how-to-understand-your-engine-management-light");
    expect(container.querySelector<HTMLInputElement>('input[name="seoTitle"]')).toHaveValue("How to Understand Your Engine Management Light");
    expect(container.querySelector<HTMLInputElement>('input[name="seoDescription"]')).toHaveValue("A clear guide to understanding an engine management warning light.");
  });

  it("locks a manually edited Article URL and can reset it from the title", async () => {
    const user = userEvent.setup();
    render(<ContentEditor articleMode action={action} media={media} />);
    const title = screen.getByLabelText("Title");
    const url = screen.getByLabelText("Article URL");
    await user.type(title, "First article title");
    expect(url).toHaveValue("first-article-title");
    await user.clear(url);
    await user.type(url, "short-guide");
    await user.clear(title);
    await user.type(title, "Replacement title");
    expect(url).toHaveValue("short-guide");
    await user.click(screen.getByRole("button", { name: "Reset from title" }));
    expect(url).toHaveValue("replacement-title");
  });

  it("warns and requires confirmation before changing a published URL", async () => {
    const user = userEvent.setup();
    const entry = {
      id: "44444444-4444-4444-8444-444444444444", kind: "article" as const, slug: "existing-guide", title: "Existing guide",
      excerpt: "An existing published article with an approved summary.", sections: [{ type: "richText" as const, paragraphs: ["Existing article content."] }],
      metadata: { category: "Diagnostics", author: "SOB Autofix Team" }, seoTitle: "Existing vehicle guide", seoDescription: "An existing published vehicle guide from the SOB Autofix team.",
      status: "published" as const, publishedAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z",
    };
    render(<ContentEditor articleMode entry={entry} action={action} media={media} />);
    await user.clear(screen.getByLabelText("Article URL"));
    await user.type(screen.getByLabelText("Article URL"), "replacement-guide");
    expect(screen.getByText(/may affect existing links and search rankings/)).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /may affect existing links/ })).toBeRequired();
  });

  it("shows scheduling controls only for scheduled articles", async () => {
    const user = userEvent.setup();
    render(<ContentEditor articleMode action={action} media={media} />);
    expect(screen.queryByLabelText("Publish date and time")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "scheduled");
    expect(screen.getByLabelText("Publish date and time")).toBeVisible();
    expect(screen.getByRole("button", { name: "Schedule article" })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Status"), "draft");
    expect(screen.queryByLabelText("Publish date and time")).not.toBeInTheDocument();
  });

  it("adds friendly related-service and CTA blocks", async () => {
    const user = userEvent.setup();
    render(<ContentEditor articleMode action={action} media={media} />);
    await user.selectOptions(screen.getByLabelText("Add content block"), "serviceCards");
    await user.selectOptions(screen.getByLabelText("Add related service"), "engine-management-light");
    expect(screen.getByRole("button", { name: /Engine Management Light/ })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Add content block"), "cta");
    await user.selectOptions(screen.getByLabelText("Call to action"), "diagnostics");
    expect(screen.getByLabelText("Call to action")).toHaveValue("diagnostics");
  });

  it("shows useful cover labels without exposing media IDs", () => {
    render(<ContentEditor articleMode action={action} media={media} />);
    const selector = screen.getByLabelText("Choose from Media Library");
    expect(selector).toHaveTextContent("Technician testing a vehicle · news");
    expect(selector).toHaveTextContent("Workshop image awaiting approval · news · Draft");
    expect(selector).not.toHaveTextContent("11111111-1111-4111-8111-111111111111");
  });

  it("uses a visual editor and stores its safe compatible article markup", () => {
    const { container } = render(<ContentEditor articleMode action={action} media={media} />);
    const editor = screen.getByRole("textbox", { name: "Article content" });
    editor.innerHTML = "<h2>Visible heading</h2><p><strong>Important</strong> guidance</p>";
    fireEvent.input(editor);
    expect(editor).toContainHTML("<h2>Visible heading</h2>");
    expect(editor).not.toHaveTextContent("##");
    expect(container.querySelector<HTMLInputElement>('input[name="sections"]')?.value).toContain("## Visible heading");
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed");
  });

  it("applies visual block and inline formatting commands without showing syntax", async () => {
    const user = userEvent.setup();
    const editorReference: { current?: HTMLElement } = {};
    const exec = vi.fn((command: string, _showUi: boolean, argument?: string) => {
      if (!editorReference.current) return false;
      if (command === "formatBlock") editorReference.current.innerHTML = argument === "<h2>" ? "<h2>Formatted heading</h2>" : "<blockquote>Formatted quote</blockquote>";
      if (command === "bold") editorReference.current.innerHTML = "<p><strong>Bold text</strong></p>";
      return true;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    render(<ContentEditor articleMode action={action} media={media} />);
    const editor = screen.getByRole("textbox", { name: "Article content" });
    editorReference.current = editor;
    await user.selectOptions(screen.getByLabelText("Text style"), "h2");
    expect(editor.querySelector("h2")).toHaveTextContent("Formatted heading");
    await user.click(screen.getByRole("button", { name: "Bold" }));
    expect(editor.querySelector("strong")).toHaveTextContent("Bold text");
    expect(editor).not.toHaveTextContent(/##|\*\*/);
  });

  it("opens an accessible link dialog with known internal destinations", async () => {
    const user = userEvent.setup();
    render(<ContentEditor articleMode action={action} media={media} />);
    await user.click(screen.getByRole("button", { name: "Link" }));
    expect(screen.getByRole("dialog", { name: "Add link" })).toBeVisible();
    expect(screen.getByLabelText("Link text")).toBeVisible();
    expect(screen.getByLabelText("URL")).toHaveValue("/diagnostics");
    expect(document.querySelector('datalist option[value="/book"]')).not.toBeNull();
  });

  it("uploads a selected cover through the supplied Media Library action", async () => {
    const upload = vi.fn(async () => ({ asset: { id: "33333333-3333-4333-8333-333333333333", alt: "Diagnostic equipment connected to a car", category: "news", published: false, url: "https://example.supabase.co/storage/v1/object/public/public-media/news/cover.jpg" } }));
    const { container } = render(<ContentEditor articleMode action={action} media={media} coverUploadAction={upload} />);
    const fileInput = screen.getByLabelText("Upload file");
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "Diagnostic equipment connected to a car" } });
    fireEvent.click(screen.getByRole("button", { name: "Upload and use" }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    await waitFor(() => expect(container.querySelector<HTMLInputElement>('input[name="metadata"]')?.value).toContain("33333333-3333-4333-8333-333333333333"));
    expect(await screen.findByAltText("Diagnostic equipment connected to a car")).toBeVisible();
  });
});
