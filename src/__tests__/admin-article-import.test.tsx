// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminUserMock } = vi.hoisted(() => ({ getAdminUserMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getAdminUser: getAdminUserMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  applyHighIntentArticleImportAction,
  previewHighIntentArticleImportAction,
  type ArticleImportActionState,
} from "@/app/admin/(protected)/news/import-actions";
import { HighIntentArticleImportControl } from "@/components/admin/high-intent-article-import-control";

const idle: ArticleImportActionState = { status: "idle", message: "" };

describe("protected admin high-intent article import", () => {
  beforeEach(() => getAdminUserMock.mockReset());

  it("rejects anonymous and authenticated non-admin action callers without reading or writing CMS data", async () => {
    getAdminUserMock.mockResolvedValue(null);
    const anonymous = await previewHighIntentArticleImportAction(idle, new FormData());
    const nonAdmin = await applyHighIntentArticleImportAction(idle, confirmedForm());
    expect(anonymous).toMatchObject({ status: "error", message: expect.stringMatching(/not authorised/i) });
    expect(nonAdmin).toMatchObject({ status: "error", message: expect.stringMatching(/not authorised/i) });
  });

  it("lets the current authorised admin preview a clean plan with zero writes", async () => {
    const admin = fakeAdmin(canonicalArticles());
    getAdminUserMock.mockResolvedValue(admin.session);
    const result = await previewHighIntentArticleImportAction(idle, new FormData());
    expect(result).toMatchObject({
      status: "preview",
      preview: {
        canApply: true,
        summary: { NEW_DRAFT: 18, ENHANCEMENT_CANDIDATE: 2, EXISTING_EXACT_SLUG: 0, POTENTIAL_CONTENT_COLLISION: 0 },
      },
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("blocks apply in the UI when a fresh preview finds an exact collision", async () => {
    const admin = fakeAdmin([...canonicalArticles(), existing("car-limp-mode-causes", "Car Limp Mode Causes")]);
    getAdminUserMock.mockResolvedValue(admin.session);
    render(<HighIntentArticleImportControl completed={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Preview Import" }));
    expect(await screen.findByText(/existing exact slug collision/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Import \d+ Drafts/ })).not.toBeInTheDocument();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("shows deliberate draft-only confirmation only after a clean preview", async () => {
    const admin = fakeAdmin(canonicalArticles());
    getAdminUserMock.mockResolvedValue(admin.session);
    render(<HighIntentArticleImportControl completed={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Preview Import" }));
    expect(await screen.findByRole("button", { name: "Import 18 Drafts" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /draft-only import/i })).toBeRequired();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("rechecks production on apply and blocks a collision introduced after preview", async () => {
    const admin = fakeAdminSequence([
      canonicalArticles(),
      [...canonicalArticles(), existing("car-limp-mode-causes", "Car Limp Mode Causes")],
    ]);
    getAdminUserMock.mockResolvedValue(admin.session);
    render(<HighIntentArticleImportControl completed={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Preview Import" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /draft-only import/i }));
    await userEvent.click(screen.getByRole("button", { name: "Import 18 Drafts" }));
    expect(await screen.findByText(/Import blocked/i)).toBeInTheDocument();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("replans on apply and invokes the RPC through the current admin session with 18 drafts only", async () => {
    const admin = fakeAdmin(canonicalArticles());
    getAdminUserMock.mockResolvedValue(admin.session);
    const result = await applyHighIntentArticleImportAction(idle, confirmedForm());
    expect(result).toMatchObject({ status: "success", message: expect.stringMatching(/18 article drafts imported successfully/i) });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    const [name, payload] = admin.rpc.mock.calls[0] as [string, { p_articles: Array<Record<string, unknown>>; p_source: string }];
    expect(name).toBe("import_article_drafts");
    expect(payload.p_source).toBe("reviewed editorial import");
    expect(payload.p_articles).toHaveLength(18);
    expect(payload.p_articles.every((article) => article.status === "draft" && !("publishedAt" in article))).toBe(true);
    expect(payload.p_articles.map((article) => article.slug)).not.toContain("what-engine-management-light-means");
    expect(payload.p_articles.map((article) => article.slug)).not.toContain("why-car-battery-keeps-going-flat");
  });

  it("requires the exact explicit confirmation before it reads or writes", async () => {
    const admin = fakeAdmin(canonicalArticles());
    getAdminUserMock.mockResolvedValue(admin.session);
    const result = await applyHighIntentArticleImportAction(idle, new FormData());
    expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/confirmation is required/i) });
    expect(getAdminUserMock).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("cannot duplicate an already imported batch", async () => {
    const imported = expectedDraftArticles();
    const admin = fakeAdmin([...canonicalArticles(), ...imported]);
    getAdminUserMock.mockResolvedValue(admin.session);
    const result = await applyHighIntentArticleImportAction(idle, confirmedForm());
    expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/Import blocked/i) });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("hides the one-time operation after audited completion and never exposes tokens", () => {
    render(<HighIntentArticleImportControl completed />);
    expect(screen.getByText("High-intent draft import completed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview Import" })).not.toBeInTheDocument();
    const sources = [
      "src/app/admin/(protected)/news/import-actions.ts",
      "src/components/admin/high-intent-article-import-control.tsx",
      "src/lib/content/high-intent-article-admin.ts",
    ].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(sources).not.toMatch(/ACCESS_TOKEN|Authorization:\s*Bearer|console\.(log|error)/);
    expect(readFileSync("src/app/admin/(protected)/layout.tsx", "utf8")).toContain("if (!admin) redirect(\"/admin/login\")");
  });
});

function confirmedForm() {
  const form = new FormData();
  form.set("confirmation", "IMPORT_18_REVIEWED_DRAFTS");
  return form;
}

function fakeAdmin(existingRows: Array<Record<string, unknown>>) {
  const rpc = vi.fn().mockResolvedValue({ data: Array.from({ length: 18 }, (_, index) => ({ id: crypto.randomUUID(), slug: `draft-${index}` })), error: null });
  const client = {
    from: vi.fn((table: string) => {
      if (table !== "content_entries") throw new Error(`Unexpected table ${table}`);
      return { select: vi.fn().mockResolvedValue({ data: existingRows, error: null }) };
    }),
    rpc,
  };
  return {
    rpc,
    session: { user: { id: crypto.randomUUID(), email: "sobautofix@gmail.com" }, profile: { user_id: crypto.randomUUID(), display_name: "SOB Autofix" }, client },
  };
}

function fakeAdminSequence(existingRows: Array<Array<Record<string, unknown>>>) {
  const queue = [...existingRows];
  const rpc = vi.fn();
  const client = {
    from: vi.fn((table: string) => {
      if (table !== "content_entries") throw new Error(`Unexpected table ${table}`);
      return { select: vi.fn().mockResolvedValue({ data: queue.shift() || [], error: null }) };
    }),
    rpc,
  };
  return {
    rpc,
    session: { user: { id: crypto.randomUUID(), email: "sobautofix@gmail.com" }, profile: { user_id: crypto.randomUUID(), display_name: "SOB Autofix" }, client },
  };
}

function canonicalArticles() {
  return [
    existing("what-engine-management-light-means", "What Your Engine Management Light Is Really Telling You"),
    existing("why-car-battery-keeps-going-flat", "Why Does My Car Battery Keep Going Flat?"),
  ];
}

function expectedDraftArticles() {
  return [
    "car-wont-start-but-lights-come-on", "car-losing-power-when-accelerating", "car-shaking-vibrating-when-driving",
    "car-limp-mode-causes", "car-knocking-noise-causes", "squeaking-grinding-brakes", "clunking-noise-over-bumps",
    "car-pulling-to-one-side", "clicking-noise-when-turning-cv-joint", "battery-warning-light-while-driving",
    "car-battery-vs-alternator-fault", "car-electrical-problems-signs", "car-overheating-causes-what-to-do",
    "coolant-disappearing-no-visible-leak", "white-blue-black-exhaust-smoke", "dpf-warning-light-uk",
    "car-diagnostics-cost-uk", "mobile-mechanic-vs-garage",
  ].map((slug) => existing(slug, slug.replaceAll("-", " "), "draft"));
}

function existing(slug: string, title: string, status = "published") {
  return {
    id: crypto.randomUUID(), kind: "article", slug, title, excerpt: "Existing editorial content.",
    seo_title: title, status, published_at: status === "published" ? "2026-08-11T12:00:00.000Z" : null, sections: [],
  };
}
