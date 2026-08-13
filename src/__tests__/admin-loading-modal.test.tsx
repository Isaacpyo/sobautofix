// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminLoadingModal } from "@/components/admin/admin-loading-modal";

describe("admin loading modal", () => {
  it("renders accessible status for login and admin navigation", () => {
    render(<AdminLoadingModal title="Signing in" description="Please wait while your secure admin dashboard loads." />);

    expect(screen.getByRole("dialog", { name: "Signing in" })).toBeVisible();
    expect(screen.getByText("Please wait while your secure admin dashboard loads.")).toBeVisible();
  });
});
