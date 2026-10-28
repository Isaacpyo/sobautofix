// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { visibleNavigationGroups } from "@/components/admin/admin-navigation";
import { findAdminSearchDestination } from "@/components/admin/admin-shell";
import { bottomNavItems, MobileBottomNav } from "@/components/admin/mobile-bottom-nav";
import { quickActionsFor } from "@/components/admin/mobile-quick-actions";

let pathname = "/admin/diary";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/admin/login/actions", () => ({ signOut: vi.fn() }));

describe("admin mobile bottom navigation", () => {
  it("shows Today, Diary, a raised New button, Customers and More with the current page marked", () => {
    pathname = "/admin/diary/new";
    render(<MobileBottomNav role="owner" menuOpen={false} onOpenMenu={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Quick navigation" });
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("href", "/admin/today");
    expect(within(nav).getByRole("link", { name: "Diary" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Customers" })).toHaveAttribute("href", "/admin/customers");
    expect(within(nav).getByRole("button", { name: /^New/ })).toHaveAttribute("aria-haspopup", "dialog");
    expect(nav.className).toContain("lg:hidden");
    expect(nav.className).toContain("safe-area-inset-bottom");
  });

  it("opens the full menu from More", async () => {
    const onOpenMenu = vi.fn();
    render(<MobileBottomNav role="owner" menuOpen={false} onOpenMenu={onOpenMenu} />);
    await userEvent.click(screen.getByRole("button", { name: /^More/ }));
    expect(onOpenMenu).toHaveBeenCalledWith(screen.getByRole("button", { name: /^More/ }));
  });

  it("opens the quick-action sheet as a dialog, closes on Escape and returns focus to New", async () => {
    pathname = "/admin/today";
    const user = userEvent.setup();
    render(<MobileBottomNav role="owner" menuOpen={false} onOpenMenu={vi.fn()} />);
    const newButton = screen.getByRole("button", { name: /^New/ });
    await user.click(newButton);
    const dialog = screen.getByRole("dialog", { name: "Create new" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("link", { name: /New appointment/ })).toHaveAttribute("href", "/admin/diary/new");
    expect(within(dialog).getByRole("link", { name: /New vehicle listing/ })).toHaveAttribute("href", "/admin/exchange/stock/new");
    expect(within(dialog).getByRole("link", { name: /New buying enquiry/ })).toHaveAttribute("href", "/admin/exchange/enquiries/new?type=buying");
    expect(within(dialog).getByRole("link", { name: /New sales enquiry/ })).toHaveAttribute("href", "/admin/exchange/enquiries/new?type=sales");
    await waitFor(() => expect(within(dialog).getByRole("link", { name: /New appointment/ })).toHaveFocus());
    expect(newButton).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(newButton).toHaveFocus();
  });

  it("keeps Tab inside the sheet", async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav role="owner" menuOpen={false} onOpenMenu={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^New/ }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("link", { name: /New appointment/ })).toHaveFocus());
    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Close create menu" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole("link", { name: /New sales enquiry/ })).toHaveFocus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("hides actions the role cannot use", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MobileBottomNav role="workshop" menuOpen={false} onOpenMenu={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^New/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("link").map((link) => link.textContent)).toEqual([expect.stringContaining("New appointment")]);
    unmount();

    expect(quickActionsFor("sales").map((action) => action.label)).toEqual(["New appointment", "New vehicle listing", "New buying enquiry", "New sales enquiry"]);
    expect(quickActionsFor("manager")).toHaveLength(4);
    expect(quickActionsFor("workshop").map((action) => action.label)).toEqual(["New appointment"]);
  });

  it("gives staff without customer access Vehicles instead of Customers", () => {
    render(<MobileBottomNav role="workshop" menuOpen={false} onOpenMenu={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Quick navigation" });
    expect(within(nav).queryByRole("link", { name: "Customers" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Vehicles" })).toHaveAttribute("href", "/admin/exchange");
    expect(bottomNavItems("sales").right.href).toBe("/admin/customers");
  });
});

describe("admin sidebar and search", () => {
  const hrefs = (role: Parameters<typeof visibleNavigationGroups>[0]) => visibleNavigationGroups(role).flatMap((group) => group.links.map((link) => link.href));

  it("adds the diary and Vehicle Buying & Selling to Operations and drops the old stock link", () => {
    const operations = visibleNavigationGroups("owner").find((group) => group.label === "Operations");
    const labels = operations?.links.map((link) => link.label) ?? [];
    expect(labels).toEqual(expect.arrayContaining(["Autofix Diary", "Vehicle Buying & Selling", "Customers"]));
    expect(labels.indexOf("Vehicle Buying & Selling")).toBe(labels.indexOf("Autofix Diary") + 1);
    expect(hrefs("owner")).not.toContain("/admin/inventory");
  });

  it("hides Customers from workshop staff", () => {
    expect(hrefs("workshop")).not.toContain("/admin/customers");
    expect(hrefs("workshop")).toContain("/admin/diary");
  });

  it("finds the new sections from the admin search", () => {
    expect(findAdminSearchDestination("Autofix Diary")).toBe("/admin/diary");
    expect(findAdminSearchDestination("diary")).toBe("/admin/diary");
    expect(findAdminSearchDestination("Vehicle Buying & Selling")).toBe("/admin/exchange");
    expect(findAdminSearchDestination("vehicle stock")).toBe("/admin/exchange/stock");
    expect(findAdminSearchDestination("customers")).toBe("/admin/customers");
    expect(findAdminSearchDestination("today")).toBe("/admin/today");
    expect(findAdminSearchDestination("")).toBeNull();
  });
});
