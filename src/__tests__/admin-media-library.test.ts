import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin media library", () => {
  it("shows image previews and provides per-image editing controls", () => {
    const page = readFileSync("src/app/admin/(protected)/media/page.tsx", "utf8");

    expect(page).toContain("<Image");
    expect(page).toContain("public/public-media/${asset.object_path}");
    expect(page).toContain("Edit details");
    expect(page).toContain("action={updateMediaDetails}");
    expect(page).toContain("file:border-[#C9D5E2]");
    expect(page).not.toContain("Unpublish");
    expect(page).not.toContain("{asset.category} · {asset.object_path}");
  });

  it("validates and persists editable media metadata", () => {
    const actions = readFileSync("src/app/admin/(protected)/actions.ts", "utf8");
    const updateAction = actions.slice(actions.indexOf("export async function updateMediaDetails"), actions.indexOf("export async function toggleMediaPublication"));

    expect(updateAction).toContain("alt_text: parsed.alt");
    expect(updateAction).toContain("category: parsed.category");
    expect(updateAction).toContain('revalidatePath("/gallery")');
  });
});
