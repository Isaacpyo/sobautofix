// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createSystemHealthChecks } from "@/lib/admin/dashboard";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn(async () => undefined) }));
vi.mock("@/app/admin/login/actions", () => ({ signOut: signOutMock }));

import { SignOutButton } from "@/components/admin/sign-out-button";

describe("admin sign out", () => {
  it("asks before signing out, and Cancel keeps the session", async () => {
    const user = userEvent.setup();
    render(<SignOutButton />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    const dialog = screen.getByRole("alertdialog", { name: "Sign out?" });
    expect(signOutMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toBeInTheDocument();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("signs out after confirming, and Escape cancels", async () => {
    const user = userEvent.setup();
    render(<SignOutButton compact />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    const confirm = screen.getAllByRole("button", { name: "Sign out" }).at(-1)!;
    await user.click(confirm);
    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
  });
});

describe("dashboard database health", () => {
  it("names the areas that could not be loaded", () => {
    const checks = createSystemHealthChecks({ websiteReady: true, databaseReady: false, databaseIssues: ["stock", "bookings"], emailReady: true, bookingReady: true, vehicleLookupReady: true });
    expect(checks.find((check) => check.label === "Database")?.detail).toBe("Could not load stock and bookings. Refresh to try again.");
  });
});
