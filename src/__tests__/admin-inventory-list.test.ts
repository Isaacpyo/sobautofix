import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin inventory list", () => {
  it("redirects the old Vehicle Stock pages to Vehicle Buying & Selling", () => {
    const list = readFileSync(join(process.cwd(), "src/app/admin/(protected)/inventory/page.tsx"), "utf8");
    const create = readFileSync(join(process.cwd(), "src/app/admin/(protected)/inventory/new/page.tsx"), "utf8");
    const edit = readFileSync(join(process.cwd(), "src/app/admin/(protected)/inventory/[id]/page.tsx"), "utf8");
    expect(list).toContain("redirect(`/admin/exchange/stock");
    expect(create).toContain('redirect("/admin/exchange/stock/new")');
    expect(edit).toContain("redirect(`/admin/exchange/stock/${id}`)");
  });

  it("provides a loading Open action for every vehicle in the new stock list", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/(protected)/exchange/stock/page.tsx"), "utf8");
    expect(source).toContain('loadingTitle="Opening vehicle"');
    expect(source).toContain(">Open<span");
  });
});
